/**
 * Auth persistence — users and one-time codes, on the shared app.db (node:sqlite).
 * Emails are stored lower-cased and used as the natural key.
 */
import { randomUUID } from "crypto";
import { db } from "../db/db";

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    verified      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_codes (
    email      TEXT NOT NULL,
    purpose    TEXT NOT NULL,          -- 'verify' | 'login' | 'reset'
    code       TEXT NOT NULL,
    expires_at INTEGER NOT NULL,       -- epoch ms
    attempts   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (email, purpose)
  );
`);

export interface User {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  createdAt: string;
}

const norm = (email: string) => (email || "").trim().toLowerCase();

function toUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name || "",
    verified: !!r.verified,
    createdAt: r.created_at,
  };
}

export function getUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const r = db.prepare("SELECT * FROM users WHERE email = ?").get(norm(email)) as any;
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
}

export function getUserById(id: string): User | null {
  const r = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  return r ? toUser(r) : null;
}

export function createUser(email: string, name: string, passwordHash: string): User {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, verified, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(id, norm(email), name || "", passwordHash, new Date().toISOString());
  return getUserById(id)!;
}

export function setVerified(email: string): void {
  db.prepare("UPDATE users SET verified = 1 WHERE email = ?").run(norm(email));
}

export function setPassword(email: string, passwordHash: string): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(passwordHash, norm(email));
}

// ---- One-time codes ---------------------------------------------------------

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

export function saveCode(email: string, purpose: string, code: string): void {
  db.prepare(
    `INSERT INTO auth_codes (email, purpose, code, expires_at, attempts)
       VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(email, purpose) DO UPDATE SET
       code = excluded.code, expires_at = excluded.expires_at, attempts = 0`
  ).run(norm(email), purpose, code, Date.now() + CODE_TTL_MS);
}

/** Returns true and clears the code on a correct, unexpired match. */
export function consumeCode(email: string, purpose: string, code: string): boolean {
  const e = norm(email);
  const r = db.prepare("SELECT * FROM auth_codes WHERE email = ? AND purpose = ?").get(e, purpose) as any;
  if (!r) return false;
  if (r.expires_at < Date.now() || r.attempts >= MAX_ATTEMPTS) {
    db.prepare("DELETE FROM auth_codes WHERE email = ? AND purpose = ?").run(e, purpose);
    return false;
  }
  if (String(r.code) !== String(code).trim()) {
    db.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ?").run(e, purpose);
    return false;
  }
  db.prepare("DELETE FROM auth_codes WHERE email = ? AND purpose = ?").run(e, purpose);
  return true;
}
