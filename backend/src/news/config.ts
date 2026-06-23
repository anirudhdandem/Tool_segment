/**
 * News notification config — recipients managed from the FRONTEND, not .env.
 *
 * Persisted to backend/data/news-config.json. Starts EMPTY (no default
 * recipient): emails only go out once the user adds addresses in the UI. The
 * Resend API KEY stays in .env (infra), but WHO gets the digest lives here.
 */
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(__dirname, "../../data");
const FILE = path.join(DATA_DIR, "news-config.json");

export interface NewsConfig {
  /** Email addresses that receive the digest. Empty ⇒ no emails sent. */
  recipients: string[];
  /** Master on/off for email alerts (feed + bell still work when off). */
  emailEnabled: boolean;
}

const DEFAULT: NewsConfig = { recipients: [], emailEnabled: true };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (e: string) => EMAIL_RE.test((e || "").trim());

export function readConfig(): NewsConfig {
  try {
    const c = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return {
      recipients: Array.isArray(c.recipients) ? c.recipients.filter(isValidEmail) : [],
      emailEnabled: c.emailEnabled !== false,
    };
  } catch {
    return { ...DEFAULT };
  }
}

function writeConfig(c: NewsConfig): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(c, null, 2));
}

/** Replace recipients and/or toggle — only the provided keys change. */
export function updateConfig(patch: Partial<NewsConfig>): NewsConfig {
  const cur = readConfig();
  const next: NewsConfig = {
    recipients: patch.recipients
      ? Array.from(new Set(patch.recipients.map((e) => e.trim().toLowerCase()).filter(isValidEmail)))
      : cur.recipients,
    emailEnabled: typeof patch.emailEnabled === "boolean" ? patch.emailEnabled : cur.emailEnabled,
  };
  writeConfig(next);
  return next;
}

/** Effective recipient list for sending (empty when disabled). */
export function activeRecipients(): string[] {
  const c = readConfig();
  return c.emailEnabled ? c.recipients : [];
}
