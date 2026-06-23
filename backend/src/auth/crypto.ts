/**
 * Auth primitives built on node:crypto — no external deps.
 *  - Passwords: scrypt with a per-user random salt.
 *  - Session tokens: compact HMAC-signed JSON (a minimal JWT-alike).
 *  - OTP codes: 6-digit numeric, generated with a CSPRNG.
 */
import {
  scryptSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
  createHmac,
} from "crypto";

// Secret for signing session tokens. Set AUTH_SESSION_SECRET in production; a
// random per-boot secret is used as a fallback (invalidates sessions on restart).
const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET || randomBytes(32).toString("hex");

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---- Passwords --------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const ref = Buffer.from(hash, "hex");
  return test.length === ref.length && timingSafeEqual(test, ref);
}

// ---- Session tokens ---------------------------------------------------------

export interface SessionClaims {
  uid: string;
  email: string;
  exp: number; // epoch ms
}

const b64url = (b: Buffer) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payload: string): string {
  return b64url(createHmac("sha256", SESSION_SECRET).update(payload).digest());
}

export function issueToken(uid: string, email: string): string {
  const claims: SessionClaims = { uid, email, exp: Date.now() + SESSION_TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(claims)));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string): SessionClaims | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    ) as SessionClaims;
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// ---- OTP --------------------------------------------------------------------

/** Cryptographically-random 6-digit code, zero-padded. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
