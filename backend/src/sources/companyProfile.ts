/**
 * Company-profile enrichment — funding, company size, transactional volume.
 *
 * This is the "Google AI Overview, but as an API" path:
 *   1. Tavily /search { include_answer:"advanced" } → a fused answer + the top
 *      result snippets (Crunchbase / LinkedIn / news / registry resellers).
 *   2. Gemini synthesises that web context PLUS its own knowledge into a
 *      confident, AI-Overview-style assessment of the three fields.
 *
 * Style note: this is deliberately a BEST-EFFORT SYNTHESIS, not a strict
 * fact-extractor. Gemini is allowed to estimate / infer (e.g. "Bootstrapped",
 * "50-200 employees", "~₹100 Cr revenue") so the fields get filled the way a
 * Google AI Overview would — rather than left blank. Values are CLAIMS, not
 * audited facts; profileSources keeps the trail.
 *
 * Degrades gracefully: no GEMINI_API_KEY → fields empty (caller → NOT_AVAILABLE).
 */
import { geminiJSON } from "./gemini";
import { getSecret } from "../config/secrets";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export interface CompanyProfile {
  funding: string;
  companySize: string;
  transactionVolume: string;
  /** " | "-joined source URLs that back the fields above. */
  profileSources: string;
}

const emptyProfile: CompanyProfile = {
  funding: "",
  companySize: "",
  transactionVolume: "",
  profileSources: "",
};

/**
 * Gather web context for the company: Tavily's fused `answer` PLUS the content
 * snippets of the top results (so even when `answer` is empty — which happens
 * for some well-known firms — Gemini still has raw material to work from).
 */
async function tavilyContext(
  name: string,
  city: string
): Promise<{ context: string; sources: string[] }> {
  const key = getSecret("TAVILY_API_KEY");
  if (!key || !name) return { context: "", sources: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          `${name} ${city} — funding raised and investors, number of employees / team size, ` +
          `annual revenue, and transaction / loan / AUM volume`,
        include_answer: "advanced",
        search_depth: "advanced",
        max_results: 8,
      }),
    });
    if (!res.ok) return { context: "", sources: [] };
    const data = (await res.json()) as {
      answer?: string;
      results?: Array<{ url?: string; content?: string }>;
    };

    const parts: string[] = [];
    if (data.answer) parts.push(data.answer);
    for (const r of data.results || []) {
      if (r.content) parts.push(r.content);
    }
    return {
      context: parts.join("\n\n").slice(0, 8000),
      sources: (data.results || []).map((r) => r.url || "").filter(Boolean).slice(0, 5),
    };
  } catch {
    return { context: "", sources: [] };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Synthesise the three fields via Gemini — COMPACT, numbers-first. We feed it the
 * web research AND let it use its own knowledge, but force terse figures (not the
 * old paragraph write-ups): "$19.3M · Series B", "297", "₹1,650 Cr disbursed".
 */
async function structureProfile(
  webContext: string,
  name: string,
  city: string
): Promise<Pick<CompanyProfile, "funding" | "companySize" | "transactionVolume"> | null> {
  const instruction =
    `Extract a COMPACT, numbers-first profile for the company "${name}"${city ? ` (${city}, India)` : ""}. ` +
    "Use the web research AND your own knowledge. Return ONLY the key figure for each field — NO sentences, NO commentary, NO investor lists, NO dates. " +
    "Each field MUST be at most 6 words. Format exactly like the examples:\n" +
    "- funding: total raised + round if known, e.g. \"$19.3M · Series B\", \"₹120 Cr\", \"$650M · Series E\". If clearly not venture-backed → \"Bootstrapped\".\n" +
    "- companySize: just the employee count or a tight range — e.g. \"297\", \"51–200\", \"1,000+\". A number only.\n" +
    "- transactionVolume: the single headline figure with a 1–2 word label, e.g. \"₹1,650 Cr disbursed\", \"$200M AUM\", \"₹15,000 Cr premium\".\n" +
    "Use an empty string \"\" for a field only if you genuinely have no basis at all.";

  const userText = `Company: ${name}${city ? `, ${city}` : ""}\n\nWeb research:\n${webContext || "(no web results found — use your own knowledge)"}`;

  const p = await geminiJSON<{
    funding?: string;
    companySize?: string;
    transactionVolume?: string;
  }>(instruction, userText, {
    type: "object",
    properties: {
      funding: { type: "string", description: "Compact figure, ≤6 words, e.g. '$19.3M · Series B' or 'Bootstrapped'. No sentences." },
      companySize: { type: "string", description: "Employee count or tight range only, e.g. '297' or '51–200'. Just the number." },
      transactionVolume: { type: "string", description: "One headline figure + 1–2 word label, e.g. '₹1,650 Cr disbursed'. No sentences." },
    },
    required: ["funding", "companySize", "transactionVolume"],
  });
  if (!p) return null;

  // Collapse any stray newlines/extra spaces the model slips in → one tidy line.
  const tidy = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
  return {
    funding: tidy(p.funding),
    companySize: tidy(p.companySize),
    transactionVolume: tidy(p.transactionVolume),
  };
}

/**
 * Best-effort funding / size / transaction-volume for one business — an
 * AI-Overview-style synthesis. Always asks Gemini (it can fall back on its own
 * knowledge when the web returns little). Empty fields → caller shows NOT_AVAILABLE.
 */
export async function enrichCompanyProfile(name: string, city: string): Promise<CompanyProfile> {
  const { context, sources } = await tavilyContext(name, city);
  console.log(`[profile] "${name}" context=${context.length}ch`);

  const structured = await structureProfile(context, name, city);
  console.log(`[profile] "${name}" gemini=${structured ? "ok" : "fail"}`);
  const profileSources = sources.join(" | ");
  if (!structured) return { ...emptyProfile, profileSources };
  return { ...structured, profileSources };
}
