/**
 * Website DISCOVERY (distinct from website MINING in websiteContacts.ts).
 *
 * Maps gives us a name but often no website — or only a social link (Instagram
 * / Facebook / Linktree), which the team decided to treat as "no real website".
 * This module uses Tavily's SEARCH endpoint to discover the business's actual
 * domain from its name + city, so the downstream Hunter + website-mining steps
 * have something to work with.
 *
 * Degrades gracefully: no TAVILY_API_KEY → returns "" (caller just skips ahead).
 */
import { getSecret } from "../config/secrets";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

/** Hosts that are NOT a company's own website — social, directories, marketplaces. */
const NON_OWN_HOSTS = [
  // social
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
  "youtube.com", "linktr.ee", "wa.me", "whatsapp.com", "pinterest.com",
  // search / maps
  "google.com", "goo.gl", "maps.app.goo.gl", "bing.com",
  // directories / aggregators / marketplaces (these masquerade as the site)
  "justdial.com", "indiamart.com", "sulekha.com", "tradeindia.com", "yelp.com",
  "citymapia.com", "wanderlog.com", "magicpin.in", "zomato.com", "swiggy.com",
  "tripadvisor.com", "tripadvisor.in", "ambitionbox.com", "glassdoor.co.in",
  "yellowpages.in", "grotal.com", "asklaila.com", "99acres.com", "lumos.in",
  "zaubacorp.com", "tofler.in", "thecompanycheck.com", "instahyre.com",
];

/** Generic words that don't help match a business name to a domain. */
const STOPWORDS = new Set([
  "the", "and", "cafe", "coffee", "restaurant", "bar", "shop", "store", "hotel",
  "pvt", "private", "ltd", "limited", "llp", "co", "company", "india", "services",
  "service", "solutions", "enterprises", "house", "center", "centre",
]);

/** Distinctive lowercase tokens of a business name (drops generic words). */
function nameTokens(name: string): string[] {
  return (name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Does this candidate plausibly BELONG to the business (vs. a random hit)?
 *
 * Only the HOST is trusted: a name token must appear in the domain itself.
 * Title matching is deliberately NOT used — directory/platform pages
 * (corner.inc, citymapia…) embed the business name in their <title>, so a
 * title match produces false positives. A missing site beats a wrong one.
 */
function belongsToBusiness(host: string, _title: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false; // can't confirm → don't guess
  const hostFlat = host.replace(/[^a-z0-9]/g, "");
  return tokens.some((t) => hostFlat.includes(t));
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** True when `website` is empty or a social/directory link (→ treat as no site). */
export function isSocialOrEmpty(website: string): boolean {
  if (!website || !website.startsWith("http")) return true;
  const h = hostOf(website);
  return !h || NON_OWN_HOSTS.some((bad) => h === bad || h.endsWith(`.${bad}`));
}

/**
 * Website-BUILDER / shared-hosting platforms. A business on one of these has a
 * domain like `the-loanwale.ueniweb.com` — its registrable domain is the
 * PLATFORM, not the business. Domain-keyed lookups (Hunter, Apollo) would return
 * the platform's staff, so we must NOT trust the domain for those. Mining the
 * actual page is still fine (it fetches the real subdomain).
 */
const BUILDER_HOSTS = [
  "ueniweb.com", "wixsite.com", "wix.com", "business.site", "godaddysites.com",
  "weebly.com", "squarespace.com", "wordpress.com", "blogspot.com", "wensite.in",
  "mystrikingly.com", "strikingly.com", "webnode.com", "webnode.page", "jimdofree.com",
  "jimdo.com", "sites.google.com", "github.io", "netlify.app", "vercel.app",
  "dotpe.in", "gleasy.in", "myinstamojo.com", "company.site", "websitebuilder.com",
  "page.link", "framer.website", "carrd.co", "yolasite.com", "simdif.com",
];

/**
 * True when the domain belongs to a website-builder / shared host — meaning a
 * Hunter/Apollo DOMAIN search would resolve to the platform's org, not this
 * business. Callers should skip those sources (but may still mine the page).
 */
export function isBuilderOrSharedHost(website: string): boolean {
  if (!website || !website.startsWith("http")) return false;
  const h = hostOf(website);
  if (!h) return false;
  return BUILDER_HOSTS.some((bad) => h === bad || h.endsWith(`.${bad}`));
}

/**
 * Discover a business's OWN website via Tavily search.
 *
 * Web search is noisy — directories/aggregators (citymapia, wanderlog, justdial…)
 * often outrank the real site. So we don't just take the first non-social hit;
 * we require the candidate to plausibly belong to the business (a distinctive
 * name token appears in its host or title). If nothing qualifies we return ""
 * (an empty website is better than a confident-but-wrong directory link).
 */
export async function discoverWebsite(name: string, city: string): Promise<string> {
  const key = getSecret("TAVILY_API_KEY");
  if (!key || !name) return "";
  const tokens = nameTokens(name);
  if (tokens.length === 0) return ""; // name too generic to verify a match

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${name} ${city} official website contact`,
        max_results: 8,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { results?: Array<{ url?: string; title?: string }> };
    for (const r of data.results || []) {
      const url = r.url || "";
      if (!url || isSocialOrEmpty(url)) continue; // skip social + known directories
      const host = hostOf(url);
      if (!host) continue;
      if (belongsToBusiness(host, r.title || "", tokens)) {
        return `https://${host}`; // site root → miner can hit /contact, /about
      }
    }
    return "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
