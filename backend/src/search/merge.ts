import { Lead, businessKey } from "../types";

/**
 * Merge two value strings, preferring the existing non-empty one but filling
 * blanks from the incoming. Used when the same business appears in both the
 * registry and Google Maps.
 */
const pick = (a: string, b: string) => (a && a.trim() ? a : b || "");

/** Combine two leads for the same business into one richer record. */
function combine(base: Lead, extra: Lead): Lead {
  return {
    ...base,
    phone: pick(base.phone, extra.phone),
    address: pick(base.address, extra.address),
    website: pick(base.website, extra.website),
    rating: pick(base.rating, extra.rating),
    reviewCount: pick(base.reviewCount, extra.reviewCount),
    email: pick(base.email, extra.email),
    contactName: pick(base.contactName, extra.contactName),
    designation: pick(base.designation, extra.designation),
    pincode: pick(base.pincode, extra.pincode),
    // Keep the registry category if we have one; note both sources.
    category: pick(base.category, extra.category),
    source:
      base.source === extra.source ? base.source : `${base.source}+${extra.source}`,
  };
}

/**
 * Merge DB leads and Places leads into one deduped list.
 *
 * Registry leads come first (they're the trusted, complete list); a Maps lead
 * with the same businessKey enriches the registry row rather than adding a
 * duplicate. Maps-only businesses (the fresh / informal segment) are appended.
 * Finally we assign stable sequential ids so the SSE stream can patch rows.
 */
export function mergeLeads(registry: Lead[], places: Lead[]): Lead[] {
  const byKey = new Map<string, Lead>();

  for (const l of registry) {
    const k = businessKey(l.name, l.city);
    byKey.set(k, byKey.has(k) ? combine(byKey.get(k)!, l) : l);
  }
  for (const l of places) {
    const k = businessKey(l.name, l.city);
    if (byKey.has(k)) byKey.set(k, combine(byKey.get(k)!, l));
    else byKey.set(k, l);
  }

  return [...byKey.values()].map((l, i) => ({ ...l, id: `lead-${i}` }));
}
