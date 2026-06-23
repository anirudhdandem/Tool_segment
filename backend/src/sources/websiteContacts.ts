/**
 * Website contact mining — the "get everyone the site lists" pass.
 *
 * The old version blind-guessed a fixed path list and stopped after 3 pages, so
 * the page that actually holds the team (often /about-us or /leadership) was
 * never fetched. This version DISCOVERS the real links:
 *
 *   1. Fetch the homepage, read its <a> tags, and follow the ones that look like
 *      about / team / leadership / management / people / contact pages.
 *   2. Fetch each of those (plain HTTP GET → Tavily Extract fallback for JS/blocked
 *      sites), plus a few classic fallback paths in case the nav hides them.
 *   3. Feed the combined visible text to Gemini and pull an ARRAY of people
 *      {name, designation, email, phone}. Also regex every email/phone on the way.
 *
 * Degrades gracefully: no Tavily key → plain fetch only; no Gemini key → we still
 * return the emails/phones we scraped.
 */
import * as cheerio from "cheerio";
import { geminiJSON } from "./gemini";
import { PersonContact } from "../types";
import { getSecret } from "../config/secrets";

export interface WebsiteMineResult {
  contacts: PersonContact[];
  emails: string[];
  phones: string[];
}

/** Classic fallback paths, used in addition to discovered links. */
const FALLBACK_PATHS = [
  "/about-us", "/about", "/team", "/our-team", "/leadership", "/management",
  "/people", "/our-people", "/board", "/founders", "/contact", "/contact-us",
];
/** href / anchor-text signals that a link points at a who's-who page. */
const LINK_HINT = /about|team|leader|manage|people|founder|director|board|contact|company|who-?we-?are|our-?story/i;
const MAX_PAGES = 8;
const FETCH_TIMEOUT_MS = 9000;
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

const empty: WebsiteMineResult = { contacts: [], emails: [], phones: [] };
const fileEmail = (e: string) => /\.(png|jpe?g|gif|svg|css|js|webp|ico)$/i.test(e);
const uniq = (a: string[]) => Array.from(new Set(a));

function normBase(website: string): string {
  let b = website.trim().replace(/\/+$/, "");
  if (!b.startsWith("http")) b = "https://" + b;
  return b;
}
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/** Pull readable text + emails + phones out of raw HTML. */
function readableFromHtml(html: string): { text: string; emails: string[]; phones: string[] } {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const emails = uniq((html.match(EMAIL_RE) || []).filter((e) => !fileEmail(e)));
  const phones = uniq(html.match(PHONE_RE) || []);
  return { text, emails, phones };
}

/** Same, but for the clean text Tavily Extract returns. */
function signalsFromText(raw: string): { text: string; emails: string[]; phones: string[] } {
  return {
    text: raw,
    emails: uniq((raw.match(EMAIL_RE) || []).filter((e) => !fileEmail(e))),
    phones: uniq(raw.match(PHONE_RE) || []),
  };
}

/** Step 1 — free plain fetch; returns raw HTML or null. */
async function plainFetch(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.length > 300 ? html : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Step 2 — Tavily Extract fallback for JS-heavy / blocking sites (batchable). */
async function tavilyExtract(urls: string[]): Promise<Record<string, string>> {
  const key = getSecret("TAVILY_API_KEY");
  if (!key || urls.length === 0) return {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(TAVILY_EXTRACT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urls.slice(0, 20) }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { results?: Array<{ url?: string; raw_content?: string }> };
    const out: Record<string, string> = {};
    for (const r of data.results || []) {
      if (r.url && r.raw_content) out[r.url] = r.raw_content;
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/** Read the homepage and return the on-site links that look like who's-who pages. */
function discoverLinks(homeHtml: string, base: string, host: string): string[] {
  const $ = cheerio.load(homeHtml);
  const found = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const anchorText = $(el).text().trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (!LINK_HINT.test(href) && !LINK_HINT.test(anchorText)) return;
    let abs: string;
    try { abs = new URL(href, base + "/").toString().split("#")[0].replace(/\/+$/, ""); }
    catch { return; }
    if (hostOf(abs) !== host) return; // stay on the company's own site
    found.add(abs);
  });
  return Array.from(found);
}

/** Step 3 — structure the combined page text into an ARRAY of named people. */
async function structurePeople(text: string): Promise<PersonContact[]> {
  if (text.length < 40) return [];
  const parsed = await geminiJSON<{ people?: Array<{ name?: string; designation?: string; email?: string; phone?: string }> }>(
    "From this company website text, extract EVERY named individual who works at or leads the company " +
      "(founders, directors, C-level, partners, managers, key staff). For each, give their name, their role/designation, " +
      "and their email and phone if stated next to them. Return an empty list only if no real person is named. " +
      "Do not invent people or contact details.",
    text.slice(0, 14000),
    {
      type: "object",
      properties: {
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              designation: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
            required: ["name", "designation", "email", "phone"],
          },
        },
      },
      required: ["people"],
    },
    20000
  );
  if (!parsed?.people) return [];
  return parsed.people
    .map((p) => ({
      name: (p.name || "").trim(),
      designation: (p.designation || "").trim(),
      email: (p.email || "").trim(),
      phone: (p.phone || "").trim(),
      linkedin: "",
      source: "Website",
      confidence: (p.email || "").trim() ? 82 : 68,
    }))
    .filter((p) => p.name.length > 1);
}

/**
 * Mine a website for ALL the people + emails + phones it exposes. Discovers the
 * real about/team/leadership links from the homepage, fetches them (plus a few
 * classic fallbacks), and LLM-extracts every named person from the combined text.
 */
export async function mineWebsiteForContacts(website: string): Promise<WebsiteMineResult> {
  if (!website || !website.startsWith("http")) return { ...empty };
  const base = normBase(website);
  const host = hostOf(base);
  if (!host) return { ...empty };

  // 1. Homepage → discover real who's-who links.
  const homeHtml = await plainFetch(base);
  const discovered = homeHtml ? discoverLinks(homeHtml, base, host) : [];

  // 2. Candidate page set: homepage + discovered links + fallback guesses.
  const candidates = uniq([
    base,
    ...discovered,
    ...FALLBACK_PATHS.map((p) => base + p),
  ]).slice(0, MAX_PAGES);

  const allText: string[] = [];
  const allEmails: string[] = [];
  const allPhones: string[] = [];
  const needTavily: string[] = [];

  // Seed with the homepage we already have.
  if (homeHtml) {
    const r = readableFromHtml(homeHtml);
    allText.push(r.text);
    allEmails.push(...r.emails);
    allPhones.push(...r.phones);
  }

  // 3. Plain-fetch the rest; queue failures for a single batched Tavily call.
  await Promise.all(
    candidates
      .filter((u) => u !== base)
      .map(async (url) => {
        const html = await plainFetch(url);
        if (html) {
          const r = readableFromHtml(html);
          allText.push(r.text);
          allEmails.push(...r.emails);
          allPhones.push(...r.phones);
        } else {
          needTavily.push(url);
        }
      })
  );

  // 4. Tavily Extract fallback for everything plain-fetch couldn't read.
  if (needTavily.length) {
    const extracted = await tavilyExtract([base, ...needTavily]);
    for (const raw of Object.values(extracted)) {
      const r = signalsFromText(raw);
      allText.push(r.text);
      allEmails.push(...r.emails);
      allPhones.push(...r.phones);
    }
  }

  const emails = uniq(allEmails);
  const phones = uniq(allPhones);
  const combinedText = allText.join("\n\n").replace(/\s+/g, " ").trim();

  // 5. LLM-extract every named person from the combined corpus.
  const contacts = await structurePeople(combinedText);

  return { contacts, emails, phones };
}
