/**
 * SQLite persistence (built-in node:sqlite — no native deps).
 * Stores each discovery run as a named "search" with its full company results,
 * so the frontend can rehydrate companies after a refresh and reopen past
 * searches by name.
 */
// @ts-ignore - node:sqlite types may be absent depending on @types/node version
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(__dirname, "../../data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS searches (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    segment        TEXT,
    query          TEXT,
    city           TEXT,
    pincode        TEXT,
    radius         TEXT,
    max_results    INTEGER,
    company_count  INTEGER DEFAULT 0,
    emails_count   INTEGER DEFAULT 0,
    contacts_count INTEGER DEFAULT 0,
    companies_json TEXT NOT NULL DEFAULT '[]',
    created_at     TEXT NOT NULL
  );
`);

export interface SearchRecord {
  id: string;
  name: string;
  segment: string;
  query: string;
  city: string;
  pincode: string;
  radius: string;
  maxResults: number;
  companyCount: number;
  emailsCount: number;
  contactsCount: number;
  companies: any[];
  createdAt: string;
}

function safeParse(s: string): any[] {
  try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

function toRecord(r: any): SearchRecord {
  return {
    id: r.id,
    name: r.name,
    segment: r.segment || "",
    query: r.query || "",
    city: r.city || "",
    pincode: r.pincode || "",
    radius: r.radius || "",
    maxResults: Number(r.max_results) || 0,
    companyCount: Number(r.company_count) || 0,
    emailsCount: Number(r.emails_count) || 0,
    contactsCount: Number(r.contacts_count) || 0,
    companies: safeParse(r.companies_json),
    createdAt: r.created_at,
  };
}

export function listSearches(): SearchRecord[] {
  return (db.prepare("SELECT * FROM searches ORDER BY created_at DESC").all() as any[]).map(toRecord);
}

export function getSearch(id: string): SearchRecord | null {
  const r = db.prepare("SELECT * FROM searches WHERE id = ?").get(id) as any;
  return r ? toRecord(r) : null;
}

export interface CreateSearchInput {
  name: string;
  segment?: string;
  query?: string;
  city?: string;
  pincode?: string;
  radius?: string;
  maxResults?: number;
  companies?: any[];
  companyCount?: number;
  emailsCount?: number;
  contactsCount?: number;
}

export function createSearch(input: CreateSearchInput): SearchRecord {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const companies = Array.isArray(input.companies) ? input.companies : [];
  db.prepare(
    `INSERT INTO searches
       (id, name, segment, query, city, pincode, radius, max_results,
        company_count, emails_count, contacts_count, companies_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.segment || "",
    input.query || "",
    input.city || "",
    input.pincode || "",
    input.radius || "",
    Number(input.maxResults) || 0,
    input.companyCount ?? companies.length,
    Number(input.emailsCount) || 0,
    Number(input.contactsCount) || 0,
    JSON.stringify(companies),
    createdAt
  );
  return getSearch(id)!;
}

export function renameSearch(id: string, name: string): SearchRecord | null {
  db.prepare("UPDATE searches SET name = ? WHERE id = ?").run(name, id);
  return getSearch(id);
}

export function deleteSearch(id: string): boolean {
  const res = db.prepare("DELETE FROM searches WHERE id = ?").run(id) as any;
  return Number(res.changes) > 0;
}
