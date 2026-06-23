/**
 * App store — a small typed context that holds everything the UI needs.
 *
 * NO MOCK DATA. Everything starts empty and is populated exclusively by REAL
 * backend results: runDiscovery streams from the backend SSE endpoint and merges
 * results into the master company list live. From that real data flow:
 *   - companies  ← discovered + enriched leads (merged, deduped)
 *   - contacts   ← derived from companies that have a real contact/email
 *   - jobs       ← one per discovery run (live status)
 *   - exports    ← recorded when the user actually exports
 *   - lists      ← created by the user
 *   - dashboard metrics ← computed from the above
 * On first load every surface is empty until the user runs a real search.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

// Backend origin. Override at build time with VITE_API_BASE (e.g. your deployed
// API URL); falls back to the local dev server.
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:4000";
export const NOT_AVAILABLE = "Details not present";

// ---- Auth-aware fetch -------------------------------------------------------
// Every backend call (except the public /api/auth/* endpoints) requires a bearer
// session token. apiFetch injects it and notifies the app on a 401 so the UI can
// drop back to the login screen.
const AUTH_TOKEN_KEY = "prospio_auth_token";
export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);
export const setAuthToken = (t: string | null) =>
  t ? localStorage.setItem(AUTH_TOKEN_KEY, t) : localStorage.removeItem(AUTH_TOKEN_KEY);

let unauthorizedHandler: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { unauthorizedHandler = fn; };

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(API_BASE + path, { ...init, headers });
  if (res.status === 401) unauthorizedHandler?.();
  return res;
}

export type Page =
  | "dashboard" | "discovery" | "companies" | "contacts"
  | "exports" | "news" | "settings";

/** One industry-news story from the backend watcher (fintech/banking). */
export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
  category: string;
  company: string;
  amount: string;
  round: string;
  sector: string;
  importance: number;
  summary: string;
  read: boolean;
  emailed: boolean;
  fetchedAt: string;
}

export type Status = "new" | "enriching" | "enriched";

/** One decision-maker found for a company (from Hunter / Apollo / Website / Web). */
export interface PersonContact {
  name: string;
  designation: string;
  email: string;
  phone: string;
  linkedin: string;
  source: string;
  confidence: number;
}

export interface Company {
  id: string;
  name: string;
  category: string;
  city: string;
  state?: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  rating?: string;
  reviewCount?: string;
  companySize?: string;
  funding?: string;
  transactionVolume?: string;
  contactName?: string;
  designation?: string;
  /** All decision-makers found for this company, deduped across sources. */
  contacts?: PersonContact[];
  profileSources?: string;
  description?: string;
  source?: string;
  status: Status;
  score: number;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  company: string;
  companyId: string;
  email: string;
  phone: string;
  linkedin?: string;
  source: string;
  confidence: number;
}

export interface SavedList {
  id: string;
  name: string;
  companyIds: string[];
  color: string;
  createdAt: string;
}

export interface Job {
  id: string;
  query: string;
  companiesProcessed: number;
  emailsFound: number;
  contactsFound: number;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
}

export interface ExportRow {
  id: string;
  name: string;
  companies: number;
  contacts: number;
  date: string;
  format: "CSV" | "XLSX";
}

/** A persisted discovery run, saved by name in the backend DB. */
export interface SavedSearch {
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
  companies: Company[];
  createdAt: string;
}

export interface ApiKeyStatus {
  name: string;              // e.g. "HUNTER_API_KEY"
  configured: boolean;
  source: "frontend" | "env" | "none";
  hint: string;              // masked preview, never the raw secret
}

/** The signed-in employee. */
export interface AuthUser { id: string; email: string; name: string; }

/** Result of an auth step: success, a required next step, or an error message. */
export interface AuthResult { ok?: boolean; next?: "2fa" | "verify"; error?: string; }

export const SEGMENTS = [
  "DSA for Loans", "Mutual Fund Distributors", "Financial Advisors",
  "Wealth Advisors", "Insurance Advisors", "FinTech", "BondTech",
  "UPI Apps", "NBFCs", "Stock Brokers", "Sub Brokers",
];

/** Sentinel state option that searches across the whole country (no city scope). */
export const ALL_INDIA = "All India";

export const STATES_CITIES: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun"],
  Assam: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat"],
  Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"],
  Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba"],
  Delhi: ["New Delhi", "Dwarka", "Rohini", "Saket"],
  Goa: ["Panaji", "Margao", "Vasco da Gama"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Hisar", "Karnal"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"],
  Karnataka: ["Bengaluru", "Mysuru", "Hubli", "Mangaluru", "Belagavi"],
  Kerala: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad"],
  Manipur: ["Imphal"],
  Meghalaya: ["Shillong"],
  Mizoram: ["Aizawl"],
  Nagaland: ["Kohima", "Dimapur"],
  Odisha: ["Bhubaneswar", "Cuttack", "Rourkela", "Sambalpur"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Mohali"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"],
  Sikkim: ["Gangtok"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
  Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar"],
  Tripura: ["Agartala"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Agra", "Varanasi"],
  Uttarakhand: ["Dehradun", "Haridwar", "Roorkee", "Haldwani"],
  "West Bengal": ["Kolkata", "Howrah", "Siliguri", "Durgapur", "Asansol"],
  // Union Territories
  Chandigarh: ["Chandigarh"],
  "Jammu and Kashmir": ["Srinagar", "Jammu"],
  Puducherry: ["Puducherry"],
};

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);

/** Dedupe key shared by live discovery merges and saved-search rehydration. */
const companyKey = (c: Company) => `${(c.name || "").toLowerCase()}|${(c.city || "").toLowerCase()}`;

/** Friendly relative time from an ISO timestamp, for the search history list. */
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function clean(v?: string) {
  return v && v !== NOT_AVAILABLE ? v : "";
}

/** Synthetic 0–100 lead score from the signals we actually have. */
export function scoreOf(c: Partial<Company>): number {
  let s = 30;
  if (clean(c.website)) s += 14;
  if (clean(c.email)) s += 18;
  if (clean(c.phone)) s += 8;
  if (clean(c.contactName)) s += 12;
  if (clean(c.funding)) s += 8;
  if (clean(c.companySize)) s += 8;
  const r = parseFloat(c.rating || "");
  if (!isNaN(r)) s += Math.min(8, Math.round((r / 5) * 8));
  return Math.max(0, Math.min(100, s));
}

interface RawLead {
  id: string; name: string; category: string; city: string; address?: string;
  phone?: string; website?: string; email?: string; rating?: string; reviewCount?: string;
  companySize?: string; funding?: string; transactionVolume?: string;
  contactName?: string; designation?: string; profileSources?: string; source?: string;
  contacts?: PersonContact[];
}

function leadToCompany(l: RawLead, segment: string): Company {
  const enriched = !!(clean(l.companySize) || clean(l.funding) || clean(l.email) || clean(l.contactName) || (l.contacts && l.contacts.length > 0));
  const c: Company = {
    id: l.id || uid(),
    name: l.name,
    category: l.category || segment,
    city: l.city || "",
    address: l.address,
    phone: l.phone,
    website: l.website,
    email: l.email,
    rating: l.rating,
    reviewCount: l.reviewCount,
    companySize: l.companySize,
    funding: l.funding,
    transactionVolume: l.transactionVolume,
    contactName: l.contactName,
    designation: l.designation,
    contacts: l.contacts || [],
    profileSources: l.profileSources,
    source: l.source || "Google Maps",
    status: enriched ? "enriched" : "new",
    score: 0,
  };
  c.score = scoreOf(c);
  return c;
}

// ---- derive real contacts from real companies -----------------------------

/**
 * Contacts are derived from the real enriched companies. Every named person the
 * backend found (across Hunter / Apollo / Website / Web) becomes its own row, so
 * the Contacts surface shows the full coverage — not just one per company. No
 * fabricated data: all fields come straight from the merged backend contacts.
 */
function deriveContacts(companies: Company[]): Contact[] {
  const out: Contact[] = [];
  for (const c of companies) {
    const people = c.contacts || [];
    if (people.length > 0) {
      people.forEach((p, i) => {
        if (!clean(p.name) && !clean(p.email)) return;
        out.push({
          id: `${c.id}:${i}`,
          name: clean(p.name) || "—",
          title: clean(p.designation) || "Decision Maker",
          company: c.name,
          companyId: c.id,
          email: clean(p.email),
          phone: clean(p.phone),
          linkedin: clean(p.linkedin),
          source: p.source || "Website",
          confidence: p.confidence || 60,
        });
      });
    } else if (clean(c.contactName) || clean(c.email)) {
      // Back-compat: a lead that carries only the primary fields.
      out.push({
        id: c.id,
        name: clean(c.contactName) || "—",
        title: clean(c.designation) || "Decision Maker",
        company: c.name,
        companyId: c.id,
        email: clean(c.email),
        phone: clean(c.phone),
        linkedin: "",
        source: clean(c.email) ? "Website" : "Web",
        confidence: clean(c.email) && clean(c.contactName) ? 90 : clean(c.email) ? 70 : 50,
      });
    }
  }
  return out;
}

function dayLabels(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }));
  }
  return out;
}

export interface SeriesPoint { label: string; value: number; }

interface StoreShape {
  // auth
  user: AuthUser | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (name: string, email: string, password: string) => Promise<AuthResult>;
  confirmCode: (email: string, code: string, mode: "verify" | "2fa") => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resetPassword: (email: string, code: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  page: Page; setPage: (p: Page) => void;
  // data
  companies: Company[];
  discovery: Company[];
  contacts: Contact[];
  lists: SavedList[];
  jobs: Job[];
  exports: ExportRow[];
  searchHistory: { id: string; query: string; location: string; results: number; at: string }[];
  // metrics
  leadsSeries: SeriesPoint[];
  contactsSeries: SeriesPoint[];
  topCategories: SeriesPoint[];
  // discovery
  discovering: boolean;
  discoveryPhase: "idle" | "scanning" | "enriching";
  discoveryProgress: { done: number; total: number } | null;
  /** For "top" mode: the metric the list was ranked by (AI-stated). */
  discoveryBasis: string;
  resolved: Set<string>;
  runDiscovery: (p: DiscoveryParams) => Promise<void>;
  // persisted, named searches (backend SQLite)
  savedSearches: SavedSearch[];
  loadSearch: (id: string) => void;
  renameSearch: (id: string, name: string) => Promise<void>;
  deleteSearch: (id: string) => Promise<void>;
  // selection (company drawer)
  openCompanyId: string | null;
  openCompany: (id: string | null) => void;
  // actions
  createList: (name: string) => string;
  addToList: (listId: string, companyIds: string[]) => void;
  recordExport: (name: string, companyIds: string[], format: "CSV" | "XLSX") => void;
  apiKeyStatus: ApiKeyStatus[];
  saveApiKeys: (patch: Record<string, string>) => Promise<string | null>;
  // industry news
  news: NewsItem[];
  newsLastRun: string | null;
  newsLoading: boolean;
  newsRefreshing: boolean;
  newsUnread: number;
  newsImportantUnread: number;
  importantThreshold: number;
  fetchNews: () => Promise<void>;
  refreshNews: () => Promise<void>;
  markNewsRead: (ids?: string[], all?: boolean) => Promise<void>;
  // news email recipients (configured here, not in .env)
  newsRecipients: string[];
  newsEmailEnabled: boolean;
  newsProviderReady: boolean;
  saveNewsConfig: (patch: { recipients?: string[]; emailEnabled?: boolean }) => Promise<string | null>;
}

export interface DiscoveryParams {
  segment: string; customQuery?: string; city: string; pincode?: string;
  radius?: string; maxResults: number; name?: string;
  /** "top" = AI-ranked national list (Tavily→Gemini) instead of Maps scrape. */
  mode?: "top";
}

const Ctx = createContext<StoreShape | null>(null);
export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
};

const LIST_COLORS = ["#6366F1", "#10B981", "#6396E0", "#F59E0B", "#8B5CF6", "#EC4899"];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState<Page>("dashboard");
  // Everything starts empty — populated only by real backend discovery results.
  const [companies, setCompanies] = useState<Company[]>([]);
  const [discovery, setDiscovery] = useState<Company[]>([]);
  const [lists, setLists] = useState<SavedList[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [exportsList, setExportsList] = useState<ExportRow[]>([]);
  const [searchHistory, setSearchHistory] = useState<StoreShape["searchHistory"]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const [discovering, setDiscovering] = useState(false);
  const [discoveryPhase, setDiscoveryPhase] = useState<"idle" | "scanning" | "enriching">("idle");
  const [discoveryBasis, setDiscoveryBasis] = useState("");
  const [discoveryProgress, setDiscoveryProgress] = useState<{ done: number; total: number } | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);

  // ---- auth ---------------------------------------------------------------
  // `authReady` gates the first render until we've checked any stored token.
  // `user` null ⇒ show the login/signup screen; set ⇒ show the app.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  function setSession(token: string, u: AuthUser) {
    setAuthToken(token);
    setUser(u);
  }
  function logout() {
    setAuthToken(null);
    setUser(null);
    // Reset any in-memory state so the next account starts clean.
    setCompanies([]); setDiscovery([]); setSavedSearches([]); setSearchHistory([]);
    setNews([]); setApiKeyStatus([]); setPage("dashboard");
  }

  // Verify a stored token on boot; drop it if the backend rejects it.
  useEffect(() => {
    setUnauthorizedHandler(() => { setAuthToken(null); setUser(null); });
    (async () => {
      if (getAuthToken()) {
        try {
          const res = await apiFetch("/api/auth/me");
          if (res.ok) { const d = await res.json(); setUser(d.user); }
          else setAuthToken(null);
        } catch { /* backend down — treat as logged out */ }
      }
      setAuthReady(true);
    })();
    return () => setUnauthorizedHandler(null);
  }, []);

  async function authPost(path: string, body: any): Promise<any> {
    const res = await apiFetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return { res, d };
  }

  // Each returns a discriminated result the auth screen drives its steps from.
  async function login(email: string, password: string): Promise<AuthResult> {
    const { res, d } = await authPost("/api/auth/login", { email, password });
    if (res.ok && d.status === "2fa") return { next: "2fa" };
    if (d.status === "verify") return { next: "verify", error: d.error };
    return { error: d.error || "Sign-in failed." };
  }
  async function signup(name: string, email: string, password: string): Promise<AuthResult> {
    const { res, d } = await authPost("/api/auth/signup", { name, email, password });
    if (res.ok && d.status === "verify") return { next: "verify" };
    return { error: d.error || "Sign-up failed." };
  }
  /** Confirm an emailed code. `mode` selects signup-verify vs login-2fa. */
  async function confirmCode(email: string, code: string, mode: "verify" | "2fa"): Promise<AuthResult> {
    const { res, d } = await authPost(mode === "2fa" ? "/api/auth/2fa" : "/api/auth/verify", { email, code });
    if (res.ok && d.token) { setSession(d.token, d.user); return { ok: true }; }
    return { error: d.error || "Invalid or expired code." };
  }
  async function forgotPassword(email: string): Promise<AuthResult> {
    await authPost("/api/auth/forgot", { email });
    return { ok: true }; // always — no account enumeration
  }
  async function resetPassword(email: string, code: string, password: string): Promise<AuthResult> {
    const { res, d } = await authPost("/api/auth/reset", { email, code, password });
    if (res.ok && d.token) { setSession(d.token, d.user); return { ok: true }; }
    return { error: d.error || "Reset failed." };
  }

  // Provider API keys (all except Gemini) — managed here, persisted on the
  // backend (Settings → API Keys). The status list never carries raw secrets.
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus[]>([]);
  async function fetchApiKeys() {
    try {
      const res = await apiFetch(`/api/settings/keys`);
      if (!res.ok) return;
      const d = await res.json();
      setApiKeyStatus(d.keys || []);
    } catch { /* backend down */ }
  }
  async function saveApiKeys(patch: Record<string, string>): Promise<string | null> {
    try {
      const res = await apiFetch(`/api/settings/keys`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error || "Failed to save keys";
      setApiKeyStatus(d.keys || []);
      // Resend lives in this set — refresh news provider readiness too.
      fetchNewsConfig();
      return null;
    } catch (e: any) { return e.message || "Failed to save keys"; }
  }
  useEffect(() => { if (user) fetchApiKeys(); }, [user]);

  // ---- industry news ------------------------------------------------------
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLastRun, setNewsLastRun] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [importantThreshold, setImportantThreshold] = useState(65);

  async function fetchNews() {
    try {
      const res = await apiFetch(`/api/news`);
      if (!res.ok) return;
      const d = await res.json();
      setNews(d.items || []);
      setNewsLastRun(d.lastRun || null);
      if (typeof d.importantThreshold === "number") setImportantThreshold(d.importantThreshold);
    } catch { /* backend down → leave feed empty */ }
    finally { setNewsLoading(false); }
  }
  async function refreshNews() {
    setNewsRefreshing(true);
    try {
      await apiFetch(`/api/news/refresh`, { method: "POST" });
      await fetchNews();
    } catch { /* ignore */ }
    finally { setNewsRefreshing(false); }
  }
  async function markNewsRead(ids?: string[], all?: boolean) {
    setNews((prev) => prev.map((n) => (all || (ids && ids.includes(n.id)) ? { ...n, read: true } : n)));
    try {
      await apiFetch(`/api/news/read`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? { all: true } : { ids: ids || [] }),
      });
    } catch { /* optimistic update already applied */ }
  }

  const [newsRecipients, setNewsRecipients] = useState<string[]>([]);
  const [newsEmailEnabled, setNewsEmailEnabled] = useState(true);
  const [newsProviderReady, setNewsProviderReady] = useState(false);

  async function fetchNewsConfig() {
    try {
      const res = await apiFetch(`/api/news/config`);
      if (!res.ok) return;
      const d = await res.json();
      setNewsRecipients(d.recipients || []);
      setNewsEmailEnabled(d.emailEnabled !== false);
      setNewsProviderReady(!!d.providerReady);
    } catch { /* backend down */ }
  }
  async function saveNewsConfig(patch: { recipients?: string[]; emailEnabled?: boolean }): Promise<string | null> {
    try {
      const res = await apiFetch(`/api/news/config`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error || "Failed to save";
      setNewsRecipients(d.recipients || []);
      setNewsEmailEnabled(d.emailEnabled !== false);
      setNewsProviderReady(!!d.providerReady);
      return null;
    } catch (e: any) { return e.message || "Failed to save"; }
  }

  // Initial load + light polling so the bell badge stays fresh.
  useEffect(() => {
    if (!user) return;
    fetchNews();
    fetchNewsConfig();
    const t = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  // Rehydrate persisted searches → restores companies + history across refreshes.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/searches`);
        if (!res.ok) return;
        const d = await res.json();
        const list: SavedSearch[] = d.searches || [];
        setSavedSearches(list);

        // Master company list = union of all saved searches, deduped by name+city.
        const seen = new Set<string>();
        const merged: Company[] = [];
        for (const s of list) {
          for (const c of s.companies || []) {
            const k = companyKey(c);
            if (seen.has(k)) continue;
            seen.add(k);
            merged.push(c);
          }
        }
        if (merged.length) setCompanies(merged);

        setSearchHistory(
          list.slice(0, 8).map((s) => ({
            id: s.id, query: s.name, location: s.city, results: s.companyCount, at: relTime(s.createdAt),
          }))
        );

        // Seed today's metric points so the dashboard charts aren't flat after a refresh.
        const totalContacts = merged.reduce((n, c) => n + (c.contacts?.length || (clean(c.contactName) ? 1 : 0)), 0);
        if (merged.length) setLeadsSeries((prev) => prev.map((pt, i) => (i === prev.length - 1 ? { ...pt, value: merged.length } : pt)));
        if (totalContacts) setContactsSeries((prev) => prev.map((pt, i) => (i === prev.length - 1 ? { ...pt, value: totalContacts } : pt)));
      } catch { /* backend down → stay empty */ }
    })();
  }, [user]);

  const newsUnread = useMemo(() => news.filter((n) => !n.read).length, [news]);
  const newsImportantUnread = useMemo(
    () => news.filter((n) => !n.read && n.importance >= importantThreshold).length,
    [news, importantThreshold]
  );

  // Real metric series: a 14-day timeline that starts at zero. The last point
  // (today) grows as the user runs real discovery — no fabricated history.
  const labels = useMemo(() => dayLabels(14), []);
  const [leadsSeries, setLeadsSeries] = useState<SeriesPoint[]>(() =>
    labels.map((l) => ({ label: l, value: 0 })));
  const [contactsSeries, setContactsSeries] = useState<SeriesPoint[]>(() =>
    labels.map((l) => ({ label: l, value: 0 })));

  const contacts = useMemo(() => deriveContacts(companies), [companies]);

  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    companies.forEach((c) => counts.set(c.category, (counts.get(c.category) || 0) + 1));
    return [...counts.entries()].map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
  }, [companies]);

  const jobRef = useRef<Job | null>(null);

  async function runDiscovery(p: DiscoveryParams) {
    const segment = p.customQuery?.trim() || p.segment;
    setDiscovering(true);
    setDiscovery([]);
    setResolved(new Set());
    setDiscoveryBasis("");
    setDiscoveryPhase("scanning");
    setDiscoveryProgress(null);

    const job: Job = {
      id: `JOB-${2042 + jobs.length}`,
      query: p.city ? `${segment} · ${p.city}` : segment,
      companiesProcessed: 0, emailsFound: 0, contactsFound: 0,
      status: "running",
      startedAt: new Date().toLocaleString("en-IN", { hour12: false }).replace(",", ""),
    };
    jobRef.current = job;
    setJobs((prev) => [job, ...prev]);

    let collected: Company[] = [];
    try {
      const body: any = { searchTerm: segment, city: p.city, pincode: p.pincode || "", radius: p.radius, maxResults: p.maxResults };
      if (p.customQuery?.trim()) body.exact = true;
      if (p.mode) body.mode = p.mode;
      const res = await apiFetch(`/api/research/search-complete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `Server ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, sep); buf = buf.slice(sep + 2);
          let event = "message", data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          const d = JSON.parse(data);
          if (event === "leads") {
            collected = (d.leads || []).map((l: RawLead) => leadToCompany(l, segment));
            setDiscovery(collected);
            if (d.basis) setDiscoveryBasis(d.basis);
            setDiscoveryPhase(d.scraping ? "scanning" : "enriching");
          } else if (event === "enriched") {
            const c = leadToCompany(d.lead, segment);
            collected = collected.map((x) => (x.id === c.id ? c : x));
            setDiscovery([...collected]);
            setResolved((prev) => new Set(prev).add(c.id));
            setDiscoveryProgress({ done: d.done, total: d.total });
            setDiscoveryPhase("enriching");
          } else if (event === "done") {
            setDiscoveryProgress({ done: d.total, total: d.total });
          } else if (event === "error") {
            throw new Error(d.message || "Stream error");
          }
        }
      }
    } catch (e: any) {
      if (jobRef.current) {
        const failed = { ...jobRef.current, status: "failed" as const, completedAt: new Date().toLocaleString("en-IN", { hour12: false }).replace(",", "") };
        setJobs((prev) => prev.map((j) => (j.id === failed.id ? failed : j)));
      }
      throw e;
    } finally {
      setDiscovering(false);
      setDiscoveryPhase("idle");
    }

    // merge into master list (dedupe by name+city)
    setCompanies((prev) => {
      const have = new Set(prev.map(companyKey));
      const fresh = collected.filter((c) => !have.has(companyKey(c)));
      return [...fresh, ...prev];
    });

    // finalize job + metrics
    const emails = collected.filter((c) => clean(c.email)).length;
    const contactsFound = collected.reduce((n, c) => n + (c.contacts?.length || (clean(c.contactName) ? 1 : 0)), 0);
    if (jobRef.current) {
      const doneJob = { ...jobRef.current, companiesProcessed: collected.length, emailsFound: emails, contactsFound, status: "completed" as const, completedAt: new Date().toLocaleString("en-IN", { hour12: false }).replace(",", "") };
      setJobs((prev) => prev.map((j) => (j.id === doneJob.id ? doneJob : j)));
    }
    setLeadsSeries((prev) => prev.map((pt, i) => (i === prev.length - 1 ? { ...pt, value: pt.value + collected.length } : pt)));
    setContactsSeries((prev) => prev.map((pt, i) => (i === prev.length - 1 ? { ...pt, value: pt.value + contactsFound } : pt)));

    // persist this run as a named search (survives refresh)
    const searchName = (p.name && p.name.trim()) || (p.city ? `${segment} · ${p.city}` : segment);
    try {
      const res = await apiFetch(`/api/searches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: searchName, segment, query: p.customQuery?.trim() || "",
          city: p.city, pincode: p.pincode || "", radius: p.radius || "", maxResults: p.maxResults,
          companies: collected, companyCount: collected.length, emailsCount: emails, contactsCount: contactsFound,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.search) {
        setSavedSearches((prev) => [d.search, ...prev]);
        setSearchHistory((prev) => [{ id: d.search.id, query: d.search.name, location: d.search.city, results: d.search.companyCount, at: "Just now" }, ...prev].slice(0, 8));
        return;
      }
    } catch { /* backend save failed → fall back to local-only history */ }
    setSearchHistory((prev) => [{ id: uid(), query: searchName, location: p.city, results: collected.length, at: "Just now" }, ...prev].slice(0, 8));
  }

  // Reopen a saved search's results in the discovery view.
  function loadSearch(id: string) {
    const s = savedSearches.find((x) => x.id === id);
    if (!s) return;
    setCompanies((prev) => {
      const have = new Set(prev.map(companyKey));
      const fresh = (s.companies || []).filter((c) => !have.has(companyKey(c)));
      return [...fresh, ...prev];
    });
    setDiscoveryBasis("");
    setDiscovery(s.companies || []);
    setResolved(new Set((s.companies || []).map((c) => c.id)));
    setDiscoveryPhase("idle");
    setPage("discovery");
  }

  async function renameSearch(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedSearches((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
    setSearchHistory((prev) => prev.map((h) => (h.id === id ? { ...h, query: trimmed } : h)));
    try {
      await apiFetch(`/api/searches/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }),
      });
    } catch { /* optimistic update already applied */ }
  }

  async function deleteSearch(id: string) {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    setSearchHistory((prev) => prev.filter((h) => h.id !== id));
    try { await apiFetch(`/api/searches/${id}`, { method: "DELETE" }); }
    catch { /* optimistic update already applied */ }
  }

  function createList(name: string) {
    const id = uid();
    setLists((prev) => [{ id, name, companyIds: [], color: LIST_COLORS[prev.length % LIST_COLORS.length], createdAt: new Date().toISOString().slice(0, 10) }, ...prev]);
    return id;
  }
  function addToList(listId: string, companyIds: string[]) {
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, companyIds: [...new Set([...l.companyIds, ...companyIds])] } : l)));
  }
  function recordExport(name: string, companyIds: string[], format: "CSV" | "XLSX") {
    const cs = companies.filter((c) => companyIds.includes(c.id));
    const contactsCount = cs.filter((c) => clean(c.contactName) || clean(c.email)).length;
    setExportsList((prev) => [{ id: uid(), name, companies: cs.length, contacts: contactsCount, date: new Date().toISOString().slice(0, 10), format }, ...prev]);
  }

  const value: StoreShape = {
    user, authReady, login, signup, confirmCode, forgotPassword, resetPassword, logout,
    page, setPage, companies, discovery, contacts, lists, jobs, exports: exportsList,
    searchHistory, leadsSeries, contactsSeries, topCategories,
    discovering, discoveryPhase, discoveryProgress, discoveryBasis, resolved, runDiscovery,
    savedSearches, loadSearch, renameSearch, deleteSearch,
    openCompanyId, openCompany: setOpenCompanyId,
    createList, addToList, recordExport, apiKeyStatus, saveApiKeys,
    news, newsLastRun, newsLoading, newsRefreshing, newsUnread, newsImportantUnread,
    importantThreshold, fetchNews, refreshNews, markNewsRead,
    newsRecipients, newsEmailEnabled, newsProviderReady, saveNewsConfig,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { clean };
