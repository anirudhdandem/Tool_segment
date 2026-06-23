import { Request, Response } from "express";
import { runSearch } from "../search/search";
import { rankTopCompanies } from "../sources/topCompanies";
import { enrichLeads } from "../enrich/pipeline";
import { Lead } from "../types";

/**
 * Website enrichment (Hunter + Tavily) is OFF by default — the app runs on the
 * Google Maps scrape alone. Set ENABLE_WEBSITE_ENRICHMENT=true in .env to also
 * fill in email / contact-person for leads that have a website.
 */
// Read lazily — module-level reads run before dotenv.config() loads the .env.
const enrichmentOn = () => process.env.ENABLE_WEBSITE_ENRICHMENT === "true";
const profileOn = () => process.env.ENABLE_COMPANY_PROFILE === "true";
const anyEnrichmentOn = () => enrichmentOn() || profileOn();

/**
 * POST /api/research/search
 * Body: { searchTerm, city, pincode?, maxResults? }
 *
 * Google Maps scrape, deduped. Returns the raw (un-enriched) list.
 */
export const searchController = async (req: Request, res: Response) => {
  const { searchTerm, city, pincode, maxResults } = req.body;
  if (!searchTerm) {
    return res.status(400).json({ error: "searchTerm is required." });
  }
  try {
    const r = await runSearch(searchTerm, city || "", pincode || "", maxResults || 50);
    console.log(`[SEARCH] "${searchTerm}" → ${r.leads.length} leads (maps=${r.fromMaps})`);
    return res.status(200).json({ success: true, leads: r.leads, totalFound: r.leads.length });
  } catch (err: any) {
    console.error(`[SEARCH] Error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/research/enrich
 * Body: { leads: Lead[] }
 */
export const enrichController = async (req: Request, res: Response) => {
  const { leads } = req.body;
  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "leads array is required." });
  }
  try {
    const enriched = await enrichLeads(leads as Lead[]);
    return res.status(200).json({ success: true, leads: enriched });
  } catch (err: any) {
    console.error(`[ENRICH] Error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/research/search-complete  (Server-Sent Events)
 *
 * The single end-to-end pipeline, streamed so the user never waits blind:
 *
 *   event: leads     { leads, total, scraping }   the scraped + deduped list
 *   event: enriched  { lead, done, total }         one per lead as enrichment lands
 *   event: done      { total }
 *   event: error     { message }
 *
 * Body: { searchTerm, city, pincode?, maxResults? }
 */
export const searchCompleteController = async (req: Request, res: Response) => {
  const { searchTerm, city, pincode, maxResults, mode } = req.body;
  if (!searchTerm) {
    return res.status(400).json({ error: "searchTerm is required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let aborted = false;
  res.on("close", () => { aborted = true; });

  console.log(`\n[COMPLETE] "${searchTerm}"${city ? ` in ${city}` : ""}${mode === "top" ? " (top/AI-ranked)" : ""}`);

  // "Top companies" mode: AI-ranked national list (Tavily → Gemini), NOT Maps.
  // The list already carries name/website/city/category + a volume metric, so we
  // return it as-is (no per-company enrichment) to keep it fast and the rank intact.
  if (mode === "top") {
    try {
      const { leads, basis } = await rankTopCompanies(searchTerm, maxResults || 10);
      if (aborted) return res.end();
      send("leads", { leads, total: leads.length, scraping: false, basis });
      console.log(`[COMPLETE] AI-ranked ${leads.length} companies for "${searchTerm}" — ${basis || "(no basis)"}`);
      send("done", { total: leads.length });
    } catch (err: any) {
      console.error(`[COMPLETE] top-mode error:`, err.message);
      if (!aborted) send("error", { message: err.message });
    } finally {
      res.end();
    }
    return;
  }

  try {
    const limit = maxResults || 50;
    const r = await runSearch(searchTerm, city || "", pincode || "", limit);

    // The scraped + deduped list (stable ids).
    send("leads", { leads: r.leads, total: r.leads.length, scraping: false });
    console.log(
      `[COMPLETE] ${r.leads.length} leads (maps=${r.fromMaps}, ` +
        `contact=${enrichmentOn() ? "on" : "off"}, profile=${profileOn() ? "on" : "off"})`
    );

    if (r.leads.length === 0 || !anyEnrichmentOn()) {
      send("done", { total: r.leads.length });
      return res.end();
    }

    console.log(`[COMPLETE] enriching ${r.leads.length} leads (this takes a few minutes)…`);

    // Optional website enrichment (email / contact-person) when enabled.
    await enrichLeads(r.leads, {
      onLead: (lead, done, total) => {
        if (aborted) return;
        send("enriched", { lead, done, total });
      },
    });

    if (!aborted) send("done", { total: r.leads.length });
  } catch (err: any) {
    console.error(`[COMPLETE] Error:`, err.message);
    if (!aborted) send("error", { message: err.message });
  } finally {
    res.end();
  }
};
