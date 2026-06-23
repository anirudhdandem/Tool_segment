/**
 * Web leadership search — the last-resort "any cost" net for contacts.
 *
 * When a business has no usable website (solo agents, social-only listings) or
 * the site mining surfaced no people, we still try to name the humans behind it:
 *   1. Tavily search for the founder / owner / director by company + city.
 *   2. Gemini reads the fused answer + snippets and extracts named people.
 *
 * These are WEB-SOURCED claims (no verified email), so they're tagged source
 * "Web" with lower confidence — a name to chase beats a blank row, but the UI
 * can tell them apart from Hunter/Apollo-verified contacts.
 *
 * Degrades gracefully: no Tavily / no Gemini key → returns [].
 */
import { geminiJSON } from "./gemini";
import { PersonContact } from "../types";
import { getSecret } from "../config/secrets";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

async function tavilyContext(name: string, city: string): Promise<string> {
  const key = getSecret("TAVILY_API_KEY");
  if (!key || !name) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${name} ${city} — founder, owner, director, CEO or proprietor name and designation`,
        include_answer: "advanced",
        search_depth: "advanced",
        max_results: 6,
      }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { answer?: string; results?: Array<{ content?: string }> };
    const parts: string[] = [];
    if (data.answer) parts.push(data.answer);
    for (const r of data.results || []) if (r.content) parts.push(r.content);
    return parts.join("\n\n").slice(0, 8000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find the people behind a business from the open web (name + role only). Used
 * as a fallback when website mining / Hunter / Apollo turned up no person.
 */
export async function findLeadershipViaWeb(name: string, city: string): Promise<PersonContact[]> {
  const context = await tavilyContext(name, city);
  if (!context) return [];

  const parsed = await geminiJSON<{ people?: Array<{ name?: string; designation?: string }> }>(
    `From the web research below about the company "${name}"${city ? ` (${city}, India)` : ""}, ` +
      "list the real, named people who own or lead it (founder, owner, proprietor, director, CEO, partner). " +
      "Only include a person if the research actually names them for THIS company. Return an empty list if unsure. " +
      "Do NOT guess generic names.",
    `Company: ${name}${city ? `, ${city}` : ""}\n\nWeb research:\n${context}`,
    {
      type: "object",
      properties: {
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              designation: { type: "string" },
            },
            required: ["name", "designation"],
          },
        },
      },
      required: ["people"],
    }
  );
  if (!parsed?.people) return [];
  return parsed.people
    .map((p) => ({
      name: (p.name || "").trim(),
      designation: (p.designation || "").trim(),
      email: "",
      phone: "",
      linkedin: "",
      source: "Web",
      confidence: 45,
    }))
    .filter((p) => p.name.length > 1);
}
