import { Router, Request, Response } from "express";
import { listNews, markRead, markAllRead } from "../news/store";
import { runNewsPoll } from "../news/poller";
import { IMPORTANT_THRESHOLD } from "../news/types";
import { readConfig, updateConfig, isValidEmail } from "../news/config";
import { getSecret } from "../config/secrets";

const router = Router();

const emailConfigured = () => !!getSecret("RESEND_API_KEY");

/** GET /api/news/config — recipients + email toggle (managed in the UI). */
router.get("/config", (_req: Request, res: Response) => {
  res.json({ ...readConfig(), providerReady: emailConfigured() });
});

/**
 * POST /api/news/config — update recipients and/or the email toggle.
 * Body: { recipients?: string[], emailEnabled?: boolean }
 */
router.post("/config", (req: Request, res: Response) => {
  const { recipients, emailEnabled } = req.body || {};
  if (recipients !== undefined) {
    if (!Array.isArray(recipients)) return res.status(400).json({ error: "recipients must be an array" });
    const bad = recipients.find((e: any) => typeof e !== "string" || !isValidEmail(e));
    if (bad !== undefined) return res.status(400).json({ error: `invalid email: ${bad}` });
  }
  const next = updateConfig({ recipients, emailEnabled });
  res.json({ ...next, providerReady: emailConfigured() });
});

/** GET /api/news — the stored feed (newest first) + meta. */
router.get("/", (_req: Request, res: Response) => {
  const { items, lastRun } = listNews();
  res.json({
    items,
    lastRun,
    unread: items.filter((i) => !i.read).length,
    importantUnread: items.filter((i) => !i.read && i.importance >= IMPORTANT_THRESHOLD).length,
    importantThreshold: IMPORTANT_THRESHOLD,
  });
});

/** POST /api/news/refresh — run a cycle now (manual trigger). */
router.post("/refresh", async (_req: Request, res: Response) => {
  try {
    const result = await runNewsPoll();
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[news] refresh error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/news/read — mark some (or all) items read. Body: { ids?: string[], all?: boolean } */
router.post("/read", (req: Request, res: Response) => {
  const { ids, all } = req.body || {};
  if (all) markAllRead();
  else if (Array.isArray(ids)) markRead(ids);
  res.json({ success: true });
});

export default router;
