/**
 * One news cycle: fetch → dedupe → classify (only the new ones) → store → email
 * the important ones that haven't been emailed yet.
 *
 * Called by the 2-hourly cron (src/index.ts) and by POST /api/news/refresh.
 * Guarded so two runs can't overlap.
 */
import { fetchAllNews, newsId } from "../sources/newsFeeds";
import { classifyNews } from "./classify";
import { getKnownIds, mergeNews, markEmailed } from "./store";
import { sendDigest } from "./mailer";
import { IMPORTANT_THRESHOLD, NewsItem } from "./types";

let running = false;

export interface PollResult {
  fetched: number;
  newClassified: number;
  important: number;
  emailed: number;
  skipped?: boolean;
}

export async function runNewsPoll(): Promise<PollResult> {
  if (running) {
    console.log("[news] poll already in progress — skipping");
    return { fetched: 0, newClassified: 0, important: 0, emailed: 0, skipped: true };
  }
  running = true;
  const started = Date.now();
  try {
    const raw = await fetchAllNews();

    // Only classify items we've never seen (saves Gemini calls).
    const known = getKnownIds();
    const fresh = raw.filter((r) => !known.has(newsId(r.url)));
    console.log(`[news] ${fresh.length}/${raw.length} are new → classifying`);

    const classified = fresh.length ? await classifyNews(fresh) : [];
    const { added } = mergeNews(classified);

    // Email the important, not-yet-emailed items.
    const important: NewsItem[] = added.filter((i) => i.importance >= IMPORTANT_THRESHOLD && !i.emailed);
    const emailedIds = await sendDigest(important);
    if (emailedIds.length) markEmailed(emailedIds);

    const result: PollResult = {
      fetched: raw.length,
      newClassified: added.length,
      important: important.length,
      emailed: emailedIds.length,
    };
    console.log(
      `[news] cycle done in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
        `new=${result.newClassified} important=${result.important} emailed=${result.emailed}`
    );
    return result;
  } finally {
    running = false;
  }
}
