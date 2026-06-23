/**
 * Settings API — frontend-managed provider keys (everything except Gemini).
 *
 *   GET  /api/settings/keys   → masked status per key (never the raw secret)
 *   POST /api/settings/keys   → { HUNTER_API_KEY?, TAVILY_API_KEY?, ... }
 *                                non-empty sets, empty clears, absent unchanged
 */
import { Router, Request, Response } from "express";
import { MANAGED_KEYS, setSecrets, secretsStatus } from "../config/secrets";

const router = Router();

router.get("/keys", (_req: Request, res: Response) => {
  res.json({ keys: secretsStatus() });
});

router.post("/keys", (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const patch: Record<string, string | undefined> = {};
  for (const k of MANAGED_KEYS) {
    if (k in body) patch[k] = typeof body[k] === "string" ? (body[k] as string) : "";
  }
  setSecrets(patch);
  res.json({ keys: secretsStatus() });
});

export default router;
