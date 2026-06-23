/**
 * Frontend-managed API keys.
 *
 * Every provider key EXCEPT Gemini is configured from the app's Settings → API
 * Keys page and persisted here (backend/data/api-keys.json). GEMINI_API_KEY is
 * infra and stays in .env.
 *
 * Resolution order for a key: stored (frontend) value wins; otherwise fall back
 * to the matching .env var (lets a key keep working if it's still in .env).
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(__dirname, "../../data");
const FILE = path.join(DATA_DIR, "api-keys.json");

/** Keys the user manages from the frontend (NOT Gemini). */
export const MANAGED_KEYS = [
  "HUNTER_API_KEY",
  "TAVILY_API_KEY",
  "APOLLO_API_KEY",
  "RESEND_API_KEY",
] as const;
export type ManagedKey = (typeof MANAGED_KEYS)[number];

type Store = Partial<Record<ManagedKey, string>>;

function read(): Store {
  try {
    const c = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return c && typeof c === "object" ? c : {};
  } catch {
    return {};
  }
}

function write(s: Store): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}

/** Effective secret: stored (frontend) value wins, else the .env fallback. */
export function getSecret(name: ManagedKey): string {
  const v = (read()[name] || "").trim();
  if (v) return v;
  return (process.env[name] || "").trim();
}

/**
 * Persist provided keys. A non-empty string sets the key; an empty string
 * clears it (reverting to the .env fallback). Keys absent from `patch` are
 * left unchanged. Unknown keys are ignored.
 */
export function setSecrets(patch: Record<string, string | undefined>): void {
  const cur = read();
  for (const k of MANAGED_KEYS) {
    if (!(k in patch)) continue;
    const v = (patch[k] ?? "").trim();
    if (v) cur[k] = v;
    else delete cur[k];
  }
  write(cur);
}

const mask = (v: string) => (v.length <= 4 ? "••••" : "••••" + v.slice(-4));

export interface SecretStatus {
  name: ManagedKey;
  configured: boolean;
  source: "frontend" | "env" | "none";
  hint: string; // masked preview, never the raw secret
}

/** Masked status for the Settings UI — never returns a raw secret. */
export function secretsStatus(): SecretStatus[] {
  const stored = read();
  return MANAGED_KEYS.map((name) => {
    const storedVal = (stored[name] || "").trim();
    const envVal = (process.env[name] || "").trim();
    const val = storedVal || envVal;
    return {
      name,
      configured: !!val,
      source: storedVal ? "frontend" : envVal ? "env" : "none",
      hint: val ? mask(val) : "",
    };
  });
}
