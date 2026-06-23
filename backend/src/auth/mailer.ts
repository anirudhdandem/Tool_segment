/**
 * Transactional auth emails (OTP codes) over SMTP via nodemailer.
 *
 * Configured from .env (infra secrets, gitignored):
 *   SMTP_HOST   default smtp.gmail.com
 *   SMTP_PORT   default 587 (STARTTLS)
 *   SMTP_USER   the sending mailbox, e.g. you@blostem.com
 *   SMTP_PASS   app password (Google Workspace app password)
 *   SMTP_FROM   optional display From (defaults to "Prospio <SMTP_USER>")
 *
 * If SMTP_USER/SMTP_PASS are missing we log the code to the server console
 * instead of sending — so local dev works without real credentials.
 */
import nodemailer, { Transporter } from "nodemailer";

let cached: Transporter | null = null;

function transport(): Transporter | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (Number(process.env.SMTP_PORT) || 587) === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user, pass },
  });
  return cached;
}

const PURPOSE_COPY: Record<string, { subject: string; lead: string }> = {
  verify: { subject: "Verify your Prospio account", lead: "Use this code to verify your email and finish creating your account." },
  login: { subject: "Your Prospio login code", lead: "Use this code to complete your sign-in." },
  reset: { subject: "Reset your Prospio password", lead: "Use this code to reset your password." },
};

function renderHtml(code: string, lead: string): string {
  return `
  <div style="max-width:480px;margin:0 auto;padding:24px;font-family:system-ui,Segoe UI,Arial">
    <h2 style="font:700 18px system-ui;color:#0f172a;margin:0 0 8px">Prospio</h2>
    <p style="font:14px/1.6 system-ui;color:#475569;margin:0 0 20px">${lead}</p>
    <div style="font:700 34px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:10px;color:#4f46e5;background:#eef0ff;border:1px solid #e0e3ff;border-radius:12px;padding:18px;text-align:center">${code}</div>
    <p style="font:12px/1.6 system-ui;color:#94a3b8;margin:18px 0 0">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  </div>`;
}

/** Email a one-time code. Falls back to console logging if SMTP isn't configured. */
export async function sendOtpEmail(to: string, purpose: string, code: string): Promise<void> {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.login;
  const t = transport();
  if (!t) {
    console.log(`[auth] SMTP not configured — OTP for ${to} (${purpose}): ${code}`);
    return;
  }
  const from = process.env.SMTP_FROM || `Prospio <${process.env.SMTP_USER}>`;
  await t.sendMail({
    from,
    to,
    subject: copy.subject,
    text: `Your Prospio code is ${code}. It expires in 10 minutes.`,
    html: renderHtml(code, copy.lead),
  });
  console.log(`[auth] sent ${purpose} code to ${to}`);
}
