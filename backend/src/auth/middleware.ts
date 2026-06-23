/**
 * requireAuth — gate for protected API routes. Expects a bearer session token
 * in the Authorization header, verifies its HMAC signature + expiry, and loads
 * the user onto req.user.
 */
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./crypto";
import { getUserById } from "./store";

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; name: string };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const claims = verifyToken(token);
  if (!claims) return res.status(401).json({ error: "Authentication required." });
  const user = getUserById(claims.uid);
  if (!user || !user.verified) return res.status(401).json({ error: "Session no longer valid." });
  req.user = { id: user.id, email: user.email, name: user.name };
  next();
}
