/**
 * Email digests via Resend — DORMANT until RESEND_API_KEY is set.
 *
 * No SDK: a single POST to the Resend API. If the key is missing we just log and
 * skip, so the rest of the pipeline (feed + bell) works without email configured.
 *
 * Recipients are configured in the FRONTEND (news/config.ts), NOT in .env —
 * any number of addresses, no hardcoded default. Env only holds infra:
 *   RESEND_API_KEY   — enables sending (free at resend.com)
 *   NEWS_EMAIL_FROM  — verified sender (default Resend's onboarding@resend.dev test sender)
 */
import { NewsItem } from "./types";
import { activeRecipients } from "./config";
import { getSecret } from "../config/secrets";

const RESEND_URL = "https://api.resend.com/emails";

function renderHtml(items: NewsItem[]): string {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef0f4">
          <div style="font:600 14px/1.4 system-ui,Segoe UI,Arial">
            <a href="${i.url}" style="color:#4f46e5;text-decoration:none">${escapeHtml(i.title)}</a>
          </div>
          <div style="font:13px/1.5 system-ui;color:#475569;margin-top:3px">${escapeHtml(i.summary)}</div>
          <div style="font:12px system-ui;color:#94a3b8;margin-top:4px">
            ${escapeHtml(i.source)} · ${escapeHtml(i.category)}${i.amount ? ` · ${escapeHtml(i.amount)}` : ""} · importance ${i.importance}
          </div>
        </td>
      </tr>`
    )
    .join("");
  return `
  <div style="max-width:640px;margin:0 auto;padding:8px">
    <h2 style="font:700 18px system-ui;color:#0f172a">Prospio — Fintech & Banking Updates</h2>
    <p style="font:13px system-ui;color:#64748b">${items.length} important update${items.length === 1 ? "" : "s"} in the last cycle.</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="font:12px system-ui;color:#94a3b8;margin-top:16px">Sent by your Prospio news watcher.</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/**
 * Send a digest of important items. Returns the ids actually sent (empty if no
 * key / no recipients / send failed) so the caller can flag them emailed.
 */
export async function sendDigest(items: NewsItem[]): Promise<string[]> {
  const key = getSecret("RESEND_API_KEY");
  if (!key) {
    console.log(`[news] email skipped — RESEND_API_KEY not set (${items.length} important items pending)`);
    return [];
  }
  if (items.length === 0) return [];
  const to = activeRecipients(); // configured in the frontend; empty ⇒ skip
  if (to.length === 0) {
    console.log(`[news] email skipped — no recipients configured (${items.length} important items pending)`);
    return [];
  }

  const from = process.env.NEWS_EMAIL_FROM || "Prospio News <onboarding@resend.dev>";
  const subject = `Prospio: ${items.length} fintech/banking update${items.length === 1 ? "" : "s"}`;

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html: renderHtml(items) }),
    });
    if (!res.ok) {
      console.log(`[news] Resend HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return [];
    }
    console.log(`[news] emailed ${items.length} important items to ${to.join(", ")}`);
    return items.map((i) => i.id);
  } catch (err: any) {
    console.log(`[news] email error: ${err.message}`);
    return [];
  }
}
