import { Lead } from "../types";
import { searchGoogleMaps } from "../sources/googleMaps";
import { mergeLeads } from "./merge";

export interface SearchResult {
  leads: Lead[];
  fromMaps: number;
}

// Google Maps is the ONLY source. NB: read the flag lazily (at call time) —
// module-level reads run before dotenv.config().
const mapsOn = () => process.env.ENABLE_GOOGLE_MAPS === "true";

/**
 * Search = Google Maps scrape (Playwright) → name, website, phone, address,
 * rating. Results are deduped (by businessKey) and given stable ids.
 */
export async function runSearch(
  searchTerm: string,
  city: string,
  pincode: string,
  maxResults: number
): Promise<SearchResult> {
  let mapsLeads: Lead[] = [];
  if (mapsOn()) {
    try {
      mapsLeads = await searchGoogleMaps(searchTerm, city, maxResults);
    } catch (e: any) {
      console.error(`[search] Google Maps scrape failed: ${e.message}`);
    }
  }

  // Dedup the scraped leads among themselves and assign stable ids.
  const merged = mergeLeads([], mapsLeads).slice(0, maxResults);
  return { leads: merged, fromMaps: mapsLeads.length };
}
