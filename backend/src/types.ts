/**
 * A single named person discovered for a business. Multiple sources contribute
 * (Hunter, Apollo, the company website, web leadership search) and the pipeline
 * merges + dedupes them into `Lead.contacts` for maximum coverage.
 */
export interface PersonContact {
  name: string;
  designation: string;
  email: string;
  phone: string;
  linkedin: string;
  /** Where this person came from: Hunter / Apollo / Website / Web. */
  source: string;
  /** 0–100 rough confidence in the record (has-email + named ⇒ higher). */
  confidence: number;
}

/**
 * Canonical lead shape — the single record the whole pipeline speaks.
 *
 * Field names are kept identical to what the existing React frontend consumes
 * (see frontend/src/app/App.tsx `interface Lead`) so the API contract doesn't
 * move while we swap out everything behind it.
 */
export interface Lead {
  id: string;
  name: string;
  phone: string;
  address: string;
  website: string;
  category: string;
  rating: string;
  reviewCount: string;
  yearsInBusiness: string;
  city: string;
  pincode: string;
  /** PRIMARY person to contact (the best of `contacts`, for back-compat). */
  contactName: string;
  designation: string;
  email: string;
  /** ALL decision-makers found across every source, deduped. */
  contacts: PersonContact[];
  /** Company-profile enrichment (Tavily-fused web answer → LLM-structured).
   *  When the profile step ran but found nothing, these hold NOT_AVAILABLE. */
  funding: string;
  companySize: string;
  transactionVolume: string;
  /** " | "-joined source URLs backing the profile fields (traceability). */
  profileSources: string;
  /** Where the row came from: AMFI / NSE / BSE / SEBI / MCA / Google Maps. */
  source: string;
}

/** Shown for a profile field we tried to find but the web didn't surface. */
export const NOT_AVAILABLE = "Details not present";

/** Build an empty lead with sensible defaults so callers only set what they have. */
export function emptyLead(partial: Partial<Lead> = {}): Lead {
  return {
    id: "",
    name: "",
    phone: "",
    address: "",
    website: "",
    category: "",
    rating: "",
    reviewCount: "",
    yearsInBusiness: "",
    city: "",
    pincode: "",
    contactName: "",
    designation: "",
    email: "",
    contacts: [],
    funding: "",
    companySize: "",
    transactionVolume: "",
    profileSources: "",
    source: "",
    ...partial,
  };
}

/**
 * The canonical categories we bucket every query and every ingested row into.
 * Each maps to a set of registry sources + a Google Places search phrase.
 */
export type Category =
  | "Mutual Fund Distributor"
  | "Equity Sub Broker"
  | "Financial Advisor"
  | "Loan DSA"
  | "General";

/** Normalised business key used for dedupe + enrichment caching. */
export function businessKey(name: string, city: string): string {
  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/\b(pvt|private|ltd|limited|llp|and|&|co|company|services?)\b/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  return `${norm(name)}|${norm(city)}`;
}
