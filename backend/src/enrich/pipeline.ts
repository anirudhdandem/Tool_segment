/**
 * OPTIONAL enrichment, two independent steps each gated by its own flag:
 *
 *   A. CONTACT  (ENABLE_WEBSITE_ENRICHMENT) — MAXIMUM contact coverage:
 *        For any lead with a real domain we run, in parallel, every source:
 *          • Hunter   — all people + role emails for the domain
 *          • Apollo   — full org chart (if APOLLO_API_KEY is set)
 *          • Website  — discover real about/team/leadership links, LLM-extract
 *                       every named person
 *        then MERGE + DEDUPE them into lead.contacts (best one = primary).
 *        If that still names nobody, a web leadership search is the last net.
 *   B. PROFILE  (ENABLE_COMPANY_PROFILE) — funding / company size / transaction
 *        volume via the Tavily-fused web answer (see sources/companyProfile.ts).
 *        Anything not surfaced is filled with NOT_AVAILABLE so the UI is explicit.
 *
 * A rolling worker pool keeps CONCURRENCY leads in flight; onLead fires the
 * instant each one finishes so the controller can stream it.
 */
import { Lead, PersonContact, emptyLead, NOT_AVAILABLE } from "../types";
import { findAllContactsViaHunter } from "../sources/hunter";
import { findContactsViaApollo } from "../sources/apollo";
import { mineWebsiteForContacts } from "../sources/websiteContacts";
import { findLeadershipViaWeb } from "../sources/leadershipSearch";
import { discoverWebsite, isSocialOrEmpty, isBuilderOrSharedHost } from "../sources/webDiscovery";
import { enrichCompanyProfile } from "../sources/companyProfile";

const CONCURRENCY = 6;

/** Top decision-makers — these become the primary contact ahead of HR/managers. */
const TOP_ROLE = /founder|owner|proprietor|\bceo\b|\bcfo\b|\bcto\b|\bcoo\b|\bcmo\b|\bcmd\b|chief|managing director|\bmd\b|partner|president/i;
/** Other senior-ish roles, still floated above rank-and-file staff. */
const SENIOR = /director|principal|head|\bvp\b|vice|lead|manager/i;

const nameKey = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
const isFileEmail = (e: string) => /\.(png|jpe?g|gif|svg|css|js|webp|ico)$/i.test(e);

/** Higher = better primary candidate (top role + verified email win). */
function rankContact(c: PersonContact): number {
  const role = TOP_ROLE.test(c.designation) ? 40 : SENIOR.test(c.designation) ? 18 : 0;
  return c.confidence + (c.email ? 30 : 0) + role;
}

/**
 * Merge people from every source into one deduped, ranked list. Records without
 * a name are treated as generic role emails (info@…) and returned separately so
 * they can still backfill lead.email.
 */
function mergeContacts(lists: PersonContact[][]): { people: PersonContact[]; genericEmails: string[] } {
  const byName = new Map<string, PersonContact>();
  const genericEmails = new Set<string>();

  for (const list of lists) {
    for (const c of list) {
      if (!c.name) {
        if (c.email && !isFileEmail(c.email)) genericEmails.add(c.email.toLowerCase());
        continue;
      }
      const k = nameKey(c.name);
      if (!k) continue;
      const ex = byName.get(k);
      if (!ex) { byName.set(k, { ...c }); continue; }
      // Merge duplicate person across sources — keep the richest fields.
      if (!ex.email && c.email) ex.email = c.email;
      if (!ex.phone && c.phone) ex.phone = c.phone;
      if (!ex.linkedin && c.linkedin) ex.linkedin = c.linkedin;
      if (c.designation.length > ex.designation.length) ex.designation = c.designation;
      ex.confidence = Math.max(ex.confidence, c.confidence);
      if (!ex.source.split("+").includes(c.source)) ex.source = `${ex.source}+${c.source}`;
    }
  }

  const people = Array.from(byName.values()).sort((a, b) => rankContact(b) - rankContact(a));
  return { people, genericEmails: Array.from(genericEmails) };
}

// Read lazily — module-level reads run before dotenv.config() loads the .env.
const contactOn = () => process.env.ENABLE_WEBSITE_ENRICHMENT === "true";
const profileOn = () => process.env.ENABLE_COMPANY_PROFILE === "true";

export interface EnrichOptions {
  onLead?: (lead: Lead, done: number, total: number) => void;
}

export async function enrichLeads(leads: Lead[], opts: EnrichOptions = {}): Promise<Lead[]> {
  const total = leads.length;
  const out: Lead[] = new Array(total);
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= total) break;
      console.log(`[enrich] ▶ ${i + 1}/${total} "${leads[i].name}" …`);
      out[i] = await enrichOne(leads[i]);
      const l = out[i];
      done++;
      console.log(
        `[enrich] ✓ ${done}/${total} "${l.name}" — contacts=${l.contacts.length} ` +
          `primary=${l.contactName || "-"} email=${l.email || "-"} funding=${l.funding || "-"} ` +
          `size=${l.companySize || "-"} vol=${l.transactionVolume || "-"}`
      );
      opts.onLead?.(out[i], done, total);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  return out;
}

async function enrichOne(lead: Lead): Promise<Lead> {
  const result: Lead = { ...lead };

  // ---- A. CONTACT enrichment (maximum coverage) ----------------------------
  if (contactOn()) {
    // Step 0 — DISCOVERY: Maps often gives no website, or only a social link
    // (Instagram/Facebook/Linktree → treated as "no real site"). Use Tavily
    // search to find the business's actual domain so every source can hit it.
    if (isSocialOrEmpty(result.website)) {
      const socialLink = result.website; // keep it as a fallback contact
      const discovered = await discoverWebsite(result.name, result.city);
      result.website = discovered || socialLink; // nothing better → keep social link
    }
    const realWebsite = !isSocialOrEmpty(result.website);
    // A builder/shared host (e.g. foo.ueniweb.com) means the registrable domain
    // is the PLATFORM, not the business — Hunter/Apollo would return the
    // platform's staff. So only trust the domain for those when it's the
    // business's own. Website mining still runs (it fetches the real page).
    const trustedDomain = realWebsite && !isBuilderOrSharedHost(result.website);

    // Step 1 — fan out to ALL contact sources at once for a real domain.
    let people: PersonContact[] = [];
    let genericEmails: string[] = [];
    let minedPhones: string[] = [];
    if (realWebsite) {
      const [hunter, apollo, web] = await Promise.all([
        trustedDomain ? findAllContactsViaHunter(result.website).catch(() => [] as PersonContact[]) : Promise.resolve([] as PersonContact[]),
        trustedDomain ? findContactsViaApollo(result.website).catch(() => [] as PersonContact[]) : Promise.resolve([] as PersonContact[]),
        mineWebsiteForContacts(result.website).catch(() => ({ contacts: [], emails: [], phones: [] })),
      ]);
      minedPhones = web.phones;
      const webEmailsAsGeneric: PersonContact[] = web.emails.map((e) => ({
        name: "", designation: "", email: e, phone: "", linkedin: "", source: "Website", confidence: 50,
      }));
      const merged = mergeContacts([hunter, apollo, web.contacts, webEmailsAsGeneric]);
      people = merged.people;
      genericEmails = merged.genericEmails;
    }

    // Step 2 — last-resort web leadership search if nobody was named yet.
    if (people.length === 0) {
      const web = await findLeadershipViaWeb(result.name, result.city).catch(() => [] as PersonContact[]);
      if (web.length) people = mergeContacts([web]).people;
    }

    // Step 3 — fold the merged people into the lead. Primary = best-ranked.
    result.contacts = people;
    const primary = people[0];
    if (primary) {
      result.contactName = primary.name;
      result.designation = primary.designation;
      result.email = result.email || primary.email || genericEmails[0] || "";
    } else if (!result.email && genericEmails[0]) {
      result.email = genericEmails[0];
    }
    if (!result.phone && minedPhones[0]) result.phone = minedPhones[0];

    console.log(`[contacts] "${result.name}" → ${people.length} people, ${genericEmails.length} role-emails`);
  }

  // ---- B. PROFILE enrichment (funding / size / transaction volume) ---------
  if (profileOn()) {
    const p = await enrichCompanyProfile(result.name, result.city);
    // Empty = "the web didn't surface it" → show it explicitly, never blank.
    result.funding = p.funding || NOT_AVAILABLE;
    result.companySize = p.companySize || NOT_AVAILABLE;
    result.transactionVolume = p.transactionVolume || NOT_AVAILABLE;
    result.profileSources = p.profileSources;
  }

  return result;
}

// Re-export so callers have a single import site.
export { emptyLead };
