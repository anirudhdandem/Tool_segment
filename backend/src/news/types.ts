/**
 * Industry-news item — one normalized + LLM-classified story.
 *
 * Raw fields come from the RSS/Google-News fetch; the classified fields
 * (category … summary) are filled by Gemini in news/classify.ts. Persistence +
 * read/email state live in news/store.ts.
 */
export interface NewsItem {
  /** Stable id = hash of the canonical url (used for dedupe). */
  id: string;
  title: string;
  url: string;
  /** Feed/source name, e.g. "Entrackr", "ET BFSI", "Google News". */
  source: string;
  /** ISO timestamp of publication (best-effort from the feed). */
  publishedAt: string;
  snippet: string;

  // ---- LLM classification (filled by classify.ts) ----
  /** funding | M&A | regulatory | product | leadership | partnership | other */
  category: string;
  /** The primary company the story is about ("" if none/many). */
  company: string;
  /** Compact funding figure when category=funding, e.g. "$19.3M · Series B". */
  amount: string;
  round: string;
  /** fintech | banking | nbfc | insurtech | wealthtech | payments | lending | other */
  sector: string;
  /** 0–100; ≥ IMPORTANT_THRESHOLD triggers email + bell highlight. */
  importance: number;
  /** One-line, numbers-first summary. */
  summary: string;
  /** False ⇒ off-topic noise; filtered out of the feed. */
  relevant: boolean;

  // ---- app state ----
  read: boolean;
  /** True once included in an email digest (so we never re-send it). */
  emailed: boolean;
  fetchedAt: string;
}

/** A raw item before classification. */
export type RawNews = Pick<NewsItem, "title" | "url" | "source" | "publishedAt" | "snippet">;

/** Importance at/above which an item is "important" (email + bell). */
export const IMPORTANT_THRESHOLD = 65;
