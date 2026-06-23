/**
 * Hunter.io — emails + named people for a company DOMAIN.
 *
 * Best-effort, by design: Hunter is domain-based, so it only lights up for
 * leads that have a real website domain (mostly multi-person firms). Solo
 * agents with no domain / a Gmail address return nothing — that's expected,
 * and their phone (from Places/registry) is the channel that matters anyway.
 */
const DOMAIN_SEARCH_URL = "https://api.hunter.io/v2/domain-search";

interface HunterEmail {
  value: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  seniority?: string | null;
  confidence?: number;
}
interface HunterResponse {
  data?: {
    organization?: string | null;
    emails?: HunterEmail[];
  };
  errors?: Array<{ details?: string }>;
}

import { PersonContact } from "../types";
import { getSecret } from "../config/secrets";

function getKey(): string {
  return getSecret("HUNTER_API_KEY");
}

/** Extract the registrable domain from a website URL. */
function domainOf(website: string): string {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One Hunter domain-search, with retry on 429 (rate limit) and 5xx. Hunter's
 * free tier rate-limits aggressively, so a couple of backed-off retries recover
 * a lot of leads that would otherwise come back empty.
 */
async function hunterFetch(domain: string, key: string): Promise<HunterResponse | null> {
  const url = `${DOMAIN_SEARCH_URL}?domain=${encodeURIComponent(domain)}&api_key=${key}&limit=100`;
  const delays = [0, 1500, 4000]; // up to 3 attempts
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await sleep(delays[attempt]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return (await res.json()) as HunterResponse;
      if (res.status === 429 || res.status >= 500) {
        console.log(`[Hunter] HTTP ${res.status} for ${domain} (attempt ${attempt + 1}/${delays.length})`);
        continue; // retry
      }
      console.log(`[Hunter] HTTP ${res.status} for ${domain}`);
      return null; // 4xx other than 429 → don't retry
    } catch (err: any) {
      clearTimeout(timer);
      console.log(`[Hunter] error for ${domain}: ${err.message} (attempt ${attempt + 1}/${delays.length})`);
    }
  }
  return null;
}

/**
 * Return EVERY contact Hunter knows for a business's domain — named people first
 * (with their position + confidence), plus generic role emails (info@, sales@…)
 * so nothing is dropped. Empty array if no key / no domain / nothing found.
 */
export async function findAllContactsViaHunter(website: string): Promise<PersonContact[]> {
  const key = getKey();
  if (!key || !website) return [];
  const domain = domainOf(website);
  if (!domain) return [];

  const data = await hunterFetch(domain, key);
  const emails = data?.data?.emails ?? [];
  if (emails.length === 0) return [];

  return emails.map((e) => {
    const name = [e.first_name, e.last_name].filter(Boolean).join(" ").trim();
    return {
      name,
      designation: (e.position || "").trim(),
      email: e.value || "",
      phone: "",
      linkedin: "",
      source: "Hunter",
      confidence: typeof e.confidence === "number" ? e.confidence : name ? 80 : 55,
    };
  });
}
