/**
 * Google Maps scraper — the PRIMARY lead source.
 *
 * Two-level scrape (validated 2026-06-15):
 *   1. SEARCH FEED  → list of place cards. Gives name, rating, reviewCount,
 *      category, address snippet — but NOT website or phone.
 *   2. PLACE PAGE   → each card's href is its own Maps URL. Visiting it yields
 *      website + phone + full address. This is the N+1 cost (1 search + N pages)
 *      and the main anti-bot exposure, so detail fetches are concurrency-limited
 *      with jitter.
 *
 * Selectors are Google's obfuscated classes and WILL drift; when results come
 * back empty, re-inspect with the sandbox scripts in ../../../scrape-test.
 *
 * ToS note: Google Maps prohibits automated scraping. This is gated behind
 * ENABLE_GOOGLE_MAPS and is the user's explicit choice over the Places API.
 */
import { chromium, Browser, BrowserContext } from "playwright";
import { Lead, emptyLead } from "../types";

// Env-driven tunables — read lazily (module-level reads run before dotenv).
const headlessOn = () => process.env.GMAPS_HEADLESS !== "false";
const detailConcurrency = () => Number(process.env.GMAPS_DETAIL_CONCURRENCY || 4);
const feedScrolls = () => Number(process.env.GMAPS_SCROLLS || 8);
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---- shared browser singleton (launch once, reuse across requests) ---------
let _browser: Browser | null = null;
async function browser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await chromium.launch({
    headless: headlessOn(),
    args: ["--lang=en-US", "--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  return _browser;
}

/** Close the shared browser (call on server shutdown). */
export async function closeGoogleMaps(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

async function newCtx(): Promise<BrowserContext> {
  const b = await browser();
  return b.newContext({ locale: "en-US", userAgent: UA, viewport: { width: 1366, height: 900 } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Deterministic-ish jitter without Math.random (keeps runs reproducible).
const jitter = (i: number) => 400 + ((i * 137) % 600);

/** A raw place harvested from the feed, before the detail visit fills it in. */
interface FeedPlace {
  url: string;
  name: string;
  rating: string;
  reviewCount: string;
  category: string;
}

// ---- feed: dismiss consent + harvest place cards ---------------------------
const CONSENT_FN = `(() => {
  const labels = ['accept all','reject all','i agree','accept'];
  for (const b of document.querySelectorAll('button, form [role="button"]')) {
    const t = (b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
    if (labels.some(l => t.includes(l))) { b.click(); return t; }
  }
  return null;
})()`;

const HARVEST_FN = `(() => {
  const out = [];
  document.querySelectorAll('a.hfpxzc').forEach((a) => {
    const card = a.closest('.Nv2PK') || a.parentElement;
    if (!card) return;
    const info = Array.from(card.querySelectorAll('div.W4Efsd'))
      .map(d => d.textContent.trim()).filter(Boolean).join(' ');
    // First W4Efsd block usually starts "<rating> · <category> · <area>".
    const category = (card.querySelector('div.W4Efsd')?.textContent || '')
      .split('·').map(s => s.trim()).filter(Boolean)[1] || '';
    out.push({
      url: a.href,
      name: a.getAttribute('aria-label') || '',
      rating: card.querySelector('span.MW4etd')?.textContent?.trim() || '',
      reviewCount: (card.querySelector('span.UY7F9')?.textContent || '')
        .replace(/[()\\s]/g,'').trim(),
      category,
    });
  });
  return out;
})()`;

// ---- place page: website + phone + address ---------------------------------
const DETAIL_FN = `(() => {
  const txt = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
  const website = document.querySelector('a[data-item-id="authority"]')?.href || '';
  const phoneBtn = document.querySelector('button[data-item-id^="phone"]');
  const phone = (phoneBtn?.getAttribute('data-item-id') || '').replace('phone:tel:', '');
  const addrAria = document.querySelector('button[data-item-id="address"]')?.getAttribute('aria-label') || '';
  return {
    name: txt('h1.DUwDvf'),
    website,
    phone,
    address: addrAria.replace(/^Address:\\s*/, '').trim(),
  };
})()`;

/**
 * Scrape Google Maps for businesses matching `term` in `city`.
 * Returns canonical Leads with source "Google Maps".
 */
export async function searchGoogleMaps(
  term: string,
  city: string,
  maxResults = 50
): Promise<Lead[]> {
  // City is optional: a bare company-name search (e.g. "Blostem") queries the
  // name alone. With a city we scope it ("<term> in <city>").
  const query = city.trim() ? `${term} in ${city}`.trim() : term.trim();
  const ctx = await newCtx();
  try {
    const page = await ctx.newPage();
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/?hl=en`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    const consent = await page.evaluate(CONSENT_FN);
    if (consent) await sleep(2000);

    const feedSel = 'div[role="feed"]';
    // A specific, unambiguous query (typically a company-name search) makes
    // Maps skip the results feed and land straight on that one place's page.
    // Wait for whichever appears first — the feed or a place header.
    try {
      await Promise.race([
        page.waitForSelector("a.hfpxzc", { timeout: 20000 }),
        page.waitForSelector("h1.DUwDvf", { timeout: 20000 }),
      ]);
    } catch {
      console.warn("[gmaps] no results feed — consent wall / CAPTCHA / block?");
      return [];
    }

    // No feed but a place header → single business; scrape it directly.
    const hasFeed = await page.$("a.hfpxzc");
    if (!hasFeed) {
      const d = (await page.evaluate(DETAIL_FN)) as {
        name: string;
        website: string;
        phone: string;
        address: string;
      };
      await page.close().catch(() => {});
      if (!d.name) return [];
      return [
        emptyLead({
          name: d.name,
          website: d.website,
          phone: d.phone,
          address: d.address,
          city,
          source: "Google Maps",
        }),
      ];
    }

    // Scroll the feed until we have enough cards (or scrolls run out).
    const scrolls = feedScrolls();
    for (let i = 0; i < scrolls; i++) {
      const count = await page.evaluate("document.querySelectorAll('a.hfpxzc').length");
      if (Number(count) >= maxResults) break;
      await page
        .evaluate(`(() => { const f = document.querySelector('${feedSel}'); if (f) f.scrollBy(0, f.scrollHeight); })()`)
        .catch(() => {});
      await sleep(1200);
    }

    const feed = ((await page.evaluate(HARVEST_FN)) as FeedPlace[])
      .filter((p) => p.url && p.name)
      .slice(0, maxResults);
    await page.close().catch(() => {});

    // Visit each place page (concurrency-limited) to get website + phone.
    const leads = await mapPool(feed, detailConcurrency(), async (place, i) => {
      await sleep(jitter(i));
      const p = await ctx.newPage();
      try {
        await p.goto(place.url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await p.waitForSelector("h1.DUwDvf", { timeout: 15000 }).catch(() => {});
        const d = (await p.evaluate(DETAIL_FN)) as {
          name: string;
          website: string;
          phone: string;
          address: string;
        };
        return emptyLead({
          name: d.name || place.name,
          website: d.website,
          phone: d.phone,
          address: d.address,
          category: place.category,
          rating: place.rating,
          reviewCount: place.reviewCount,
          city,
          source: "Google Maps",
        });
      } catch (e: any) {
        console.warn(`[gmaps] detail failed for "${place.name}": ${e.message}`);
        // Still return the feed-level data we have.
        return emptyLead({
          name: place.name,
          category: place.category,
          rating: place.rating,
          reviewCount: place.reviewCount,
          city,
          source: "Google Maps",
        });
      } finally {
        await p.close().catch(() => {});
      }
    });

    return leads.filter(Boolean) as Lead[];
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Run `fn` over `items` with at most `limit` concurrent, preserving order. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
