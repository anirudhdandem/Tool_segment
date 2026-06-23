/**
 * News discovery — India fintech + banking, RSS-first (free, unlimited).
 *
 * Pulls from a curated set of high-signal Indian outlets (funding + banking) and
 * a few Google News RSS queries for breadth, then normalizes everything into
 * RawNews. Classification/dedupe happen downstream (news/classify, news/store).
 *
 * Uses `rss-parser`; failures on any single feed are swallowed so one dead feed
 * never sinks the whole run.
 */
import Parser from "rss-parser";
import crypto from "crypto";
import { RawNews } from "../news/types";

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

/** Curated Indian fintech + banking feeds (verified reachable). */
const FEEDS: Array<{ name: string; url: string }> = [
  { name: "Inc42", url: "https://inc42.com/feed/" },
  { name: "YourStory", url: "https://yourstory.com/feed" },
  { name: "ET BFSI", url: "https://bfsi.economictimes.indiatimes.com/rss/topstories" },
  { name: "Livemint Money", url: "https://www.livemint.com/rss/money" },
  { name: "Livemint Companies", url: "https://www.livemint.com/rss/companies" },
  { name: "BusinessLine Banking", url: "https://www.thehindubusinessline.com/money-and-banking/feeder/default.rss" },
];

/** Google News RSS queries (India edition) for breadth on funding/banking. */
const GOOGLE_QUERIES = [
  "fintech funding India",
  "Indian startup raises Series",
  "NBFC OR bank India RBI",
  "fintech acquisition India",
];

const gnewsUrl = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=en-IN&gl=IN&ceid=IN:en`;

export const newsId = (url: string) => crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);

function clean(s?: string): string {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Keep only the most recent N items per feed (feeds list newest-first). */
const PER_FEED = 18;
/** Hard cap on items classified per cycle (bounds Gemini cost + latency). */
const MAX_PER_CYCLE = 120;

async function readFeed(name: string, url: string): Promise<RawNews[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, PER_FEED).map((it) => ({
      title: clean(it.title) || "(untitled)",
      url: (it.link || "").trim(),
      // Google News wraps the real source in the item title ("… - Source").
      source: name === "Google News" ? clean((it as any).creator) || extractSource(it.title) || name : name,
      publishedAt: it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : ""),
      snippet: clean(it.contentSnippet || (it as any).content || it.summary).slice(0, 400),
    })).filter((r) => r.url);
  } catch (err: any) {
    console.log(`[news] feed failed (${name}): ${err.message}`);
    return [];
  }
}

/** Google News titles look like "Headline - Outlet" — pull the outlet out. */
function extractSource(title?: string): string {
  const m = (title || "").match(/\s[-–]\s([^-–]+)$/);
  return m ? m[1].trim() : "";
}

/** Fetch every feed + Google query in parallel and return the merged raw list. */
export async function fetchAllNews(): Promise<RawNews[]> {
  const jobs: Promise<RawNews[]>[] = [
    ...FEEDS.map((f) => readFeed(f.name, f.url)),
    ...GOOGLE_QUERIES.map((q) => readFeed("Google News", gnewsUrl(q))),
  ];
  const results = await Promise.all(jobs);
  const all = results.flat();

  // Dedupe within this batch by url.
  const seen = new Set<string>();
  const out: RawNews[] = [];
  for (const r of all) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
  }
  // Newest first, then cap so a cycle never classifies an unbounded pile.
  out.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  const capped = out.slice(0, MAX_PER_CYCLE);
  console.log(`[news] fetched ${out.length} unique (using ${capped.length}) from ${FEEDS.length} feeds + ${GOOGLE_QUERIES.length} queries`);
  return capped;
}
