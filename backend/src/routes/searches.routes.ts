import { Router } from "express";
import { listSearches, getSearch, createSearch, renameSearch, deleteSearch } from "../db/db";

const router = Router();

// List all saved searches (each with its full company results, for rehydration).
router.get("/", (_req, res) => {
  try {
    res.json({ searches: listSearches() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch one saved search.
router.get("/:id", (req, res) => {
  const s = getSearch(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  res.json({ search: s });
});

// Save a completed search under a name.
router.post("/", (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    const saved = createSearch({
      name,
      segment: b.segment,
      query: b.query,
      city: b.city,
      pincode: b.pincode,
      radius: b.radius,
      maxResults: Number(b.maxResults) || 0,
      companies: Array.isArray(b.companies) ? b.companies : [],
      companyCount: b.companyCount,
      emailsCount: b.emailsCount,
      contactsCount: b.contactsCount,
    });
    res.status(201).json({ search: saved });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Rename a saved search.
router.patch("/:id", (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    const s = renameSearch(req.params.id, name);
    if (!s) return res.status(404).json({ error: "not found" });
    res.json({ search: s });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a saved search.
router.delete("/:id", (req, res) => {
  try {
    res.json({ ok: deleteSearch(req.params.id) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
