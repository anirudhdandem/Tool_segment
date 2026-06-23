/**
 * Auth flows — signup + email verification, password login + email-OTP 2FA,
 * and forgot/reset password. Access is restricted to a single email domain
 * (AUTH_ALLOWED_DOMAIN, default blostem.com).
 */
import { Request, Response } from "express";
import {
  createUser,
  getUserByEmail,
  setVerified,
  setPassword,
  saveCode,
  consumeCode,
} from "./store";
import { hashPassword, verifyPassword, generateOtp, issueToken } from "./crypto";
import { sendOtpEmail } from "./mailer";

const ALLOWED_DOMAIN = (process.env.AUTH_ALLOWED_DOMAIN || "blostem.com").toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const norm = (e: string) => (e || "").trim().toLowerCase();
const domainOk = (e: string) => norm(e).endsWith(`@${ALLOWED_DOMAIN}`);

function publicUser(u: { id: string; email: string; name: string }) {
  return { id: u.id, email: u.email, name: u.name };
}

/** Generate + persist + email a one-time code for the given purpose. */
async function issueOtp(email: string, purpose: "verify" | "login" | "reset") {
  const code = generateOtp();
  saveCode(email, purpose, code);
  await sendOtpEmail(email, purpose, code);
}

// POST /api/auth/signup  { name, email, password }
export async function signup(req: Request, res: Response) {
  const { name, email, password } = req.body || {};
  if (!EMAIL_RE.test(norm(email))) return res.status(400).json({ error: "Enter a valid email address." });
  if (!domainOk(email)) return res.status(403).json({ error: `Only @${ALLOWED_DOMAIN} email addresses can register.` });
  if (!password || String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const existing = getUserByEmail(email);
  if (existing && existing.verified) return res.status(409).json({ error: "An account with this email already exists. Please sign in." });

  if (existing) {
    // Re-registering an unverified account: refresh password, re-send code.
    setPassword(email, hashPassword(password));
  } else {
    createUser(email, name || "", hashPassword(password));
  }
  await issueOtp(email, "verify");
  return res.json({ status: "verify", email: norm(email) });
}

// POST /api/auth/verify  { email, code }  — completes signup, returns a session
export async function verify(req: Request, res: Response) {
  const { email, code } = req.body || {};
  const user = getUserByEmail(email);
  if (!user) return res.status(404).json({ error: "Account not found." });
  if (!consumeCode(email, "verify", code)) return res.status(400).json({ error: "Invalid or expired code." });
  setVerified(email);
  const token = issueToken(user.id, user.email);
  return res.json({ token, user: publicUser(user) });
}

// POST /api/auth/login  { email, password }  — step 1: password, then emails 2FA
export async function login(req: Request, res: Response) {
  const { email, password } = req.body || {};
  if (!domainOk(email)) return res.status(403).json({ error: `Only @${ALLOWED_DOMAIN} accounts can sign in.` });
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  if (!user.verified) {
    // Account never finished verification — restart that flow.
    await issueOtp(email, "verify");
    return res.status(403).json({ status: "verify", email: norm(email), error: "Please verify your email. We've sent you a new code." });
  }
  await issueOtp(email, "login");
  return res.json({ status: "2fa", email: norm(email) });
}

// POST /api/auth/2fa  { email, code }  — step 2: verify OTP, return a session
export async function twofa(req: Request, res: Response) {
  const { email, code } = req.body || {};
  const user = getUserByEmail(email);
  if (!user) return res.status(404).json({ error: "Account not found." });
  if (!consumeCode(email, "login", code)) return res.status(400).json({ error: "Invalid or expired code." });
  const token = issueToken(user.id, user.email);
  return res.json({ token, user: publicUser(user) });
}

// POST /api/auth/forgot  { email }  — always 200 (no account enumeration)
export async function forgot(req: Request, res: Response) {
  const { email } = req.body || {};
  const user = getUserByEmail(email);
  if (user && domainOk(email)) await issueOtp(email, "reset");
  return res.json({ status: "sent" });
}

// POST /api/auth/reset  { email, code, password }
export async function reset(req: Request, res: Response) {
  const { email, code, password } = req.body || {};
  if (!password || String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const user = getUserByEmail(email);
  if (!user) return res.status(404).json({ error: "Account not found." });
  if (!consumeCode(email, "reset", code)) return res.status(400).json({ error: "Invalid or expired code." });
  setPassword(email, hashPassword(password));
  setVerified(email); // a successful reset also proves email ownership
  const token = issueToken(user.id, user.email);
  return res.json({ token, user: publicUser(user) });
}

// GET /api/auth/me  — requires auth; echoes the current user
export async function me(req: Request & { user?: any }, res: Response) {
  return res.json({ user: req.user });
}
