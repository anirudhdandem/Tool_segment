/**
 * News persistence — a tiny JSON store at backend/data/news.json.
 *
 * Deliberately dependency-free (no native SQLite): the feed is small (we cap at
 * MAX_ITEMS), reads/writes are infrequent (every 2h + UI fetches), and a flat
 * file is trivial to inspect. Holds dedupe state + read/email flags across runs.
 */
import fs from "fs";
import path from "path";
import { NewsItem } from "./types";

const DATA_DIR = path.resolve(__dirname, "../../data");
const FILE = path.join(DATA_DIR, "news.json");
const MAX_ITEMS = 500;

interface Store {
  items: NewsItem[];
  lastRun: string | null;
}

function read(): Store {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return { items: [], lastRun: null };
  }
}

function write(store: Store): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

export function getKnownIds(): Set<string> {
  return new Set(read().items.map((i) => i.id));
}

/**
 * Merge freshly-classified items in (newest first), dedupe by id, cap the store,
 * and stamp lastRun. Returns the items that were genuinely NEW this run.
 */
export function mergeNews(fresh: NewsItem[]): { added: NewsItem[]; all: NewsItem[] } {
  const store = read();
  const known = new Set(store.items.map((i) => i.id));
  const added = fresh.filter((i) => !known.has(i.id));

  const merged = [...added, ...store.items]
    .sort((a, b) => (b.publishedAt || b.fetchedAt).localeCompare(a.publishedAt || a.fetchedAt))
    .slice(0, MAX_ITEMS);

  write({ items: merged, lastRun: new Date().toISOString() });
  return { added, all: merged };
}

export function listNews(): { items: NewsItem[]; lastRun: string | null } {
  const s = read();
  return { items: s.items, lastRun: s.lastRun };
}

export function markRead(ids: string[]): void {
  const store = read();
  const set = new Set(ids);
  store.items.forEach((i) => { if (set.has(i.id)) i.read = true; });
  write(store);
}

export function markAllRead(): void {
  const store = read();
  store.items.forEach((i) => { i.read = true; });
  write(store);
}

/** Flag items as emailed so a later digest never re-sends them. */
export function markEmailed(ids: string[]): void {
  const store = read();
  const set = new Set(ids);
  store.items.forEach((i) => { if (set.has(i.id)) i.emailed = true; });
  write(store);
}
