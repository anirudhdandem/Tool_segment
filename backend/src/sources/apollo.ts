/**
 * Apollo.io — paid people-search by company DOMAIN (optional, big coverage win).
 *
 * Gated on APOLLO_API_KEY: if the key isn't set we return [] and the pipeline
 * leans on Hunter + website mining. When it IS set, Apollo usually returns the
 * fullest org chart (founders, CXOs, partners, managers) with verified work
 * emails + LinkedIn.
 *
 * Two-step, because Apollo's search masks names/emails for API callers:
 *   1. POST /mixed_people/api_search  — find people at the domain (ids + titles,
 *      names/emails obfuscated).
 *   2. POST /people/match (per id)    — reveal the full name + work email +
 *      LinkedIn. Each match consumes ~1 Apollo credit, so we cap at MAX_PEOPLE
 *      decision-makers per company.
 */
import { PersonContact } from "../types";
import { getSecret } from "../config/secrets";

const SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const MATCH_URL = "https://api.apollo.io/api/v1/people/match?reveal_personal_emails=true";
/** Bias the search toward decision-makers but keep breadth for coverage. */
const SENIORITIES = ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager"];
/** Cap revealed people per company (each reveal costs an Apollo credit). */
const MAX_PEOPLE = 10;

interface ApolloSearchPerson { id?: string; first_name?: string; title?: string }
interface ApolloMatchPerson {
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string | null;
  linkedin_url?: string | null;
  organization?: { name?: string } | null;
}

function domainOf(website: string): string {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function apolloPost<T>(url: string, key: string, body: unknown, label: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": key,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.log(`[Apollo] ${label} HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    console.log(`[Apollo] ${label} error: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const isRealEmail = (e: string) => !!e && !/not_unlocked|email_hidden|^email@|@domain\.com$/i.test(e);

/**
 * Find people at a company via Apollo, by domain. Returns named decision-makers
 * with titles, work email (revealed), and LinkedIn. Empty array if no key / no
 * domain / nothing found / request fails (degrades gracefully).
 */
export async function findContactsViaApollo(website: string): Promise<PersonContact[]> {
  // HARD-DISABLED FOR NOW — Apollo must never be used, even if APOLLO_API_KEY
  // is set. Remove this short-circuit to re-enable. (Contact enrichment as a
  // whole is also off via ENABLE_WEBSITE_ENRICHMENT=false.)
  return [];

  const key = getSecret("APOLLO_API_KEY");
  if (!key || !website) return [];
  const domain = domainOf(website);
  if (!domain) return [];

  // 1. Search the domain for people (ids + titles; names/emails masked here).
  const search = await apolloPost<{ people?: ApolloSearchPerson[] }>(
    SEARCH_URL,
    key,
    { q_organization_domains_list: [domain], person_seniorities: SENIORITIES, page: 1, per_page: MAX_PEOPLE },
    "search"
  );
  const found = (search?.people ?? []).filter((p) => p.id).slice(0, MAX_PEOPLE);
  if (found.length === 0) return [];

  // 2. Reveal each person (full name + work email + LinkedIn). Parallel.
  const revealed = await Promise.all(
    found.map(async (p) => {
      const m = await apolloPost<{ person?: ApolloMatchPerson }>(MATCH_URL, key, { id: p.id }, "match");
      const person = m?.person;
      if (!person) return null;
      const name = (person.name || [person.first_name, person.last_name].filter(Boolean).join(" ")).trim();
      if (!name) return null;
      const email = (person.email || "").trim();
      const realEmail = isRealEmail(email) ? email : "";
      return {
        name,
        designation: (person.title || p.title || "").trim(),
        email: realEmail,
        phone: "",
        linkedin: (person.linkedin_url || "").replace(/^https?:\/\//, ""),
        source: "Apollo",
        confidence: realEmail ? 92 : 78,
      } as PersonContact;
    })
  );

  return revealed.filter((c): c is PersonContact => c !== null);
}
