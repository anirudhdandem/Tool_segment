/**
 * News classification — turns raw headlines into structured, scored items.
 *
 * Batches items into one Gemini call (cheap) and asks it to, per item: decide
 * relevance to Indian fintech/banking, bucket the category + sector, pull the
 * company + funding figure, score importance 0–100, and write a one-line
 * numbers-first summary. Items Gemini can't parse fall back to relevant=false.
 *
 * Degrades gracefully: no GEMINI_API_KEY → everything passes through as relevant
 * with neutral scores (better to show unfiltered news than nothing).
 */
import { geminiJSON } from "../sources/gemini";
import { RawNews, NewsItem } from "./types";
import { newsId } from "../sources/newsFeeds";

const BATCH = 12;

interface Classified {
  idx: number;
  relevant: boolean;
  category: string;
  company: string;
  amount: string;
  round: string;
  sector: string;
  importance: number;
  summary: string;
}

function neutralItem(r: RawNews): NewsItem {
  return {
    id: newsId(r.url),
    title: r.title,
    url: r.url,
    source: r.source,
    publishedAt: r.publishedAt,
    snippet: r.snippet,
    category: "other",
    company: "",
    amount: "",
    round: "",
    sector: "other",
    importance: 40,
    summary: r.title,
    relevant: true,
    read: false,
    emailed: false,
    fetchedAt: new Date().toISOString(),
  };
}

async function classifyBatch(batch: RawNews[]): Promise<NewsItem[]> {
  const listing = batch
    .map((r, i) => `[${i}] ${r.title}${r.snippet ? ` — ${r.snippet}` : ""} (source: ${r.source})`)
    .join("\n");

  const instruction =
    "You triage news for an INDIAN fintech & banking sales-intelligence tool. For EACH item, return:\n" +
    "- relevant: true ONLY if it concerns Indian fintech, banking, NBFC, payments, lending, insurtech, wealthtech, or a financial regulator (RBI/SEBI/IRDAI). Sports/politics/general tech ⇒ false.\n" +
    "- category: one of funding | M&A | regulatory | product | leadership | partnership | other.\n" +
    "- sector: one of fintech | banking | nbfc | payments | lending | insurtech | wealthtech | other.\n" +
    "- company: the primary company the story is about (\"\" if none).\n" +
    "- amount: if it's a funding/deal story, the compact figure e.g. \"$19.3M · Series B\" or \"₹120 Cr\"; else \"\".\n" +
    "- round: the round name if stated (e.g. \"Series B\"), else \"\".\n" +
    "- importance: 0–100. Big funding rounds, M&A, major RBI/SEBI moves, and well-known companies score high; minor/listicle/opinion score low.\n" +
    "- summary: ONE short numbers-first line (≤ 18 words). No fluff.\n" +
    "Return the SAME number of results, each tagged with its idx.";

  const parsed = await geminiJSON<{ results?: Classified[] }>(
    instruction,
    `Items:\n${listing}`,
    {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              idx: { type: "integer" },
              relevant: { type: "boolean" },
              category: { type: "string" },
              company: { type: "string" },
              amount: { type: "string" },
              round: { type: "string" },
              sector: { type: "string" },
              importance: { type: "integer" },
              summary: { type: "string" },
            },
            required: ["idx", "relevant", "category", "company", "amount", "round", "sector", "importance", "summary"],
          },
        },
      },
      required: ["results"],
    },
    25000
  );

  if (!parsed?.results) return batch.map(neutralItem); // LLM failed → don't drop the news
  const byIdx = new Map(parsed.results.map((c) => [c.idx, c]));
  const now = new Date().toISOString();
  const tidy = (s?: string) => (s || "").replace(/\s+/g, " ").trim();

  return batch.map((r, i) => {
    const c = byIdx.get(i);
    if (!c) return neutralItem(r);
    return {
      id: newsId(r.url),
      title: r.title,
      url: r.url,
      source: r.source,
      publishedAt: r.publishedAt,
      snippet: r.snippet,
      category: tidy(c.category) || "other",
      company: tidy(c.company),
      amount: tidy(c.amount),
      round: tidy(c.round),
      sector: tidy(c.sector) || "other",
      importance: Math.max(0, Math.min(100, Math.round(c.importance ?? 40))),
      summary: tidy(c.summary) || r.title,
      relevant: c.relevant !== false,
      read: false,
      emailed: false,
      fetchedAt: now,
    };
  });
}

/** Classify a list of raw items in batches; returns only RELEVANT ones. */
export async function classifyNews(raw: RawNews[]): Promise<NewsItem[]> {
  const out: NewsItem[] = [];
  for (let i = 0; i < raw.length; i += BATCH) {
    const items = await classifyBatch(raw.slice(i, i + BATCH));
    out.push(...items);
  }
  return out.filter((n) => n.relevant);
}
