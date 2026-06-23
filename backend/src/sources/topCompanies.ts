/**
 * "Top companies" discovery — AI-RESEARCH source (distinct from the Google Maps
 * scrape). Answers ranked, national questions Maps cannot: "top 10 fintech
 * companies in India", "top 5 stock brokers by turnover", etc.
 *
 * Flow: Tavily SEARCH gathers fresh web context for the query → Gemini distils
 * it (plus its own knowledge of the Indian market) into a RANKED list, ordered
 * by the most relevant volume/scale metric (turnover, active clients, UPI
 * volume, AUM, market share). Each item becomes a Lead, with the ranking metric
 * stored in `transactionVolume`.
 *
 * NB: the rank is web/LLM-sourced (editorial), not an audited figure — the UI
 * labels it accordingly.
 */
import { Lead, emptyLead } from "../types";
import { geminiJSON } from "./gemini";
import { getSecret } from "../config/secrets";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

/** Pull fresh web context for the ranking query (best-effort; "" if unavailable). */
async function tavilyContext(query: string): Promise<{ context: string; sources: string[] }> {
  const key = getSecret("TAVILY_API_KEY");
  if (!key) return { context: "", sources: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${query} — ranked list with volume / turnover / active clients / market share, India, latest`,
        include_answer: true,
        search_depth: "basic",
        max_results: 6,
      }),
    });
    if (!res.ok) return { context: "", sources: [] };
    const data = (await res.json()) as {
      answer?: string;
      results?: Array<{ url?: string; content?: string; title?: string }>;
    };
    const parts: string[] = [];
    if (data.answer) parts.push(data.answer);
    for (const r of data.results || []) {
      if (r.content) parts.push(`${r.title || ""}: ${r.content}`);
    }
    return {
      context: parts.join("\n\n").slice(0, 9000),
      sources: (data.results || []).map((r) => r.url || "").filter(Boolean).slice(0, 6),
    };
  } catch {
    return { context: "", sources: [] };
  } finally {
    clearTimeout(timer);
  }
}

interface RankedItem {
  rank?: number;
  name?: string;
  website?: string;
  city?: string;
  category?: string;
  volume?: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    basis: {
      type: "string",
      description:
        "ONE sentence naming the exact metric the list is ranked by, e.g. 'Ranked by monthly UPI transaction volume' or 'Ranked by NSE active client base'.",
    },
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "integer", description: "1-based rank, 1 = biggest." },
          name: { type: "string", description: "Official company / brand name." },
          website: { type: "string", description: "Official domain, https://… (best guess if not in research)." },
          city: { type: "string", description: "HQ city in India." },
          category: { type: "string", description: "Short sector label, e.g. 'Stock Broker', 'UPI App', 'Fintech'." },
          volume: {
            type: "string",
            description:
              "CONCRETE ranking metric WITH a number — e.g. '7.9M active clients', '₹2.1L cr ADTO', '8.5B UPI txns/mo', '$80B AUM'. Always give your best figure; avoid vague phrases.",
          },
        },
        required: ["rank", "name", "website", "city", "category", "volume"],
      },
    },
  },
  required: ["basis", "companies"],
};

const cleanUrl = (u?: string) => {
  const s = (u || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
};

export interface TopCompaniesResult {
  leads: Lead[];
  /** The metric the list was ranked by, for display (e.g. "Ranked by active clients"). */
  basis: string;
}

/**
 * Return real companies for `query`, ranked by volume/scale. The count comes
 * from a number in the query itself ("top 10 …" → 10); `count` is only the
 * fallback when the query has no number. Empty result if Gemini is unavailable.
 */
export async function rankTopCompanies(query: string, count: number): Promise<TopCompaniesResult> {
  // The number the user actually typed in the prompt wins (e.g. "top 10").
  const asked = query.match(/\b(\d{1,3})\b/);
  const n = Math.max(1, Math.min(asked ? parseInt(asked[1], 10) : count || 10, 50));
  const { context, sources } = await tavilyContext(query);

  const instruction =
    "You are a market analyst for the INDIAN market. Given a request for the TOP companies in some sector, " +
    "return a RANKED list of real companies ordered by the most relevant volume / scale metric for that sector " +
    "(trading turnover or active clients for brokers; transaction volume for payments/UPI; AUM for MFDs/NBFCs; " +
    "GMV or market share otherwise). Use the web research provided AND your own knowledge. Only REAL companies " +
    "that operate in India. Rank 1 = the biggest. " +
    "For `volume` ALWAYS give your single best CONCRETE figure with a number and a 1–3 word label — pull it from " +
    "your own knowledge when the research lacks one (e.g. brokers → active clients in millions; UPI → monthly txn " +
    "count/value; MFD/NBFC → AUM). Never answer with a vague tier like 'top-tier' — estimate a real number.";

  const userText =
    `Request: "${query}"\nReturn exactly ${n} companies (fewer only if that many don't exist).\n\n` +
    `Web research:\n${context || "(no external research available — use your own market knowledge)"}`;

  const out = await geminiJSON<{ basis?: string; companies?: RankedItem[] }>(instruction, userText, RESPONSE_SCHEMA, 55000);
  const items = Array.isArray(out?.companies) ? out!.companies! : [];

  const leads = items
    .map((c) =>
      emptyLead({
        name: (c.name || "").trim(),
        website: cleanUrl(c.website),
        city: (c.city || "").trim(),
        category: (c.category || "").trim(),
        transactionVolume: (c.volume || "").trim(),
        profileSources: sources.join(" | "),
        source: "AI Research",
      })
    )
    .filter((l) => l.name)
    .slice(0, n); // return EXACTLY the asked-for count (never more)

  return { leads, basis: (out?.basis || "").trim() };
}
