import React, { useState } from "react";
import { Radar, Mail, Lock, User, ArrowRight, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { Button, Input, cn } from "../ui";

type Mode = "login" | "signup" | "code" | "forgot" | "reset";

const ALLOWED_DOMAIN = "blostem.com";

/** Full-screen gate shown until an employee is authenticated. */
export function AuthScreen() {
  const s = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeMode, setCodeMode] = useState<"verify" | "2fa">("2fa"); // which code flow we're confirming
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = (m: Mode) => { setMode(m); setError(""); setNotice(""); setCode(""); };

  const domainOk = (e: string) => e.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");

    // Client-side domain guard (server enforces it too) for instant feedback.
    if ((mode === "login" || mode === "signup" || mode === "forgot") && !domainOk(email)) {
      setError(`Use your @${ALLOWED_DOMAIN} email address.`);
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const r = await s.login(email, password);
        if (r.ok) return;
        if (r.next === "2fa") { setCodeMode("2fa"); reset("code"); setNotice(`We emailed a 6-digit code to ${email}.`); }
        else if (r.next === "verify") { setCodeMode("verify"); reset("code"); setNotice(r.error || "Verify your email — we sent a new code."); }
        else setError(r.error || "Sign-in failed.");
      } else if (mode === "signup") {
        const r = await s.signup(name, email, password);
        if (r.next === "verify") { setCodeMode("verify"); reset("code"); setNotice(`We emailed a verification code to ${email}.`); }
        else setError(r.error || "Sign-up failed.");
      } else if (mode === "code") {
        const r = await s.confirmCode(email, code, codeMode);
        if (!r.ok) setError(r.error || "Invalid or expired code.");
        // success → user is set in the store and this screen unmounts.
      } else if (mode === "forgot") {
        await s.forgotPassword(email);
        reset("reset"); setNotice(`If an account exists for ${email}, a reset code is on its way.`);
      } else if (mode === "reset") {
        const r = await s.resetPassword(email, code, password);
        if (!r.ok) setError(r.error || "Reset failed.");
      }
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, { title: string; sub: string }> = {
    login: { title: "Welcome back", sub: "Sign in to your Blostem workspace" },
    signup: { title: "Create your account", sub: `Blostem employees only · @${ALLOWED_DOMAIN}` },
    code: { title: codeMode === "2fa" ? "Two-factor verification" : "Verify your email", sub: notice || `Enter the 6-digit code sent to ${email}` },
    forgot: { title: "Reset your password", sub: "We'll email you a reset code" },
    reset: { title: "Set a new password", sub: notice || `Enter the code sent to ${email}` },
  };
  const t = titles[mode];

  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-br from-[#EEF0FB] via-background to-[#F5F3FF] px-4 antialiased">
      <div className="w-full max-w-[420px]">
        {/* brand */}
        <div className="flex items-center gap-3 mb-7 justify-center">
          <div className="size-11 rounded-[13px] bg-primary grid place-items-center text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)]">
            <Radar className="size-[22px]" />
          </div>
          <div>
            <div className="font-display text-[20px] font-semibold text-foreground leading-none tracking-[0.01em]">Prospio</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1.5 uppercase tracking-[0.24em]">Signal Desk</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-[0_18px_50px_rgba(16,24,40,0.10)] p-7">
          <div className="mb-5">
            <h1 className="font-display text-[22px] font-semibold text-foreground tracking-[-0.01em]">{t.title}</h1>
            <p className="text-[13px] text-muted-foreground mt-1.5">{t.sub}</p>
          </div>

          {error && <Banner tone="error">{error}</Banner>}
          {notice && mode !== "code" && mode !== "reset" && <Banner tone="info">{notice}</Banner>}

          <form onSubmit={submit} className="space-y-3.5">
            {mode === "signup" && (
              <FieldIcon icon={User}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" required className="pl-9" />
              </FieldIcon>
            )}

            {(mode === "login" || mode === "signup" || mode === "forgot") && (
              <FieldIcon icon={Mail}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${ALLOWED_DOMAIN}`} autoComplete="email" required className="pl-9" />
              </FieldIcon>
            )}

            {(mode === "login" || mode === "signup") && (
              <FieldIcon icon={Lock}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "Create a password (min 8 chars)" : "Password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required className="pl-9" />
              </FieldIcon>
            )}

            {(mode === "code" || mode === "reset") && (
              <FieldIcon icon={ShieldCheck}>
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" autoComplete="one-time-code" required
                  className="pl-9 tracking-[0.5em] font-mono text-center" />
              </FieldIcon>
            )}

            {mode === "reset" && (
              <FieldIcon icon={Lock}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 8 chars)" autoComplete="new-password" required className="pl-9" />
              </FieldIcon>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full mt-1">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <>{primaryLabel(mode, codeMode)}<ArrowRight className="size-4" /></>}
            </Button>
          </form>

          {/* contextual footer links */}
          <div className="mt-5 pt-4 border-t border-border text-[13px] text-muted-foreground space-y-2">
            {mode === "login" && (<>
              <div className="flex items-center justify-between">
                <span>New here?</span>
                <button onClick={() => reset("signup")} className="font-medium text-primary hover:underline">Create an account</button>
              </div>
              <div className="flex items-center justify-between">
                <span>Forgot your password?</span>
                <button onClick={() => { setPassword(""); reset("forgot"); }} className="font-medium text-primary hover:underline">Reset it</button>
              </div>
            </>)}
            {mode === "signup" && (
              <div className="flex items-center justify-between">
                <span>Already have an account?</span>
                <button onClick={() => reset("login")} className="font-medium text-primary hover:underline">Sign in</button>
              </div>
            )}
            {(mode === "code" || mode === "forgot" || mode === "reset") && (
              <button onClick={() => { setPassword(""); reset("login"); }} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                <ArrowLeft className="size-3.5" />Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Restricted to Blostem employees. Access is logged.
        </p>
      </div>
    </div>
  );
}

function primaryLabel(mode: Mode, codeMode: "verify" | "2fa") {
  if (mode === "login") return "Sign in";
  if (mode === "signup") return "Create account";
  if (mode === "code") return codeMode === "2fa" ? "Verify & sign in" : "Verify email";
  if (mode === "forgot") return "Send reset code";
  return "Reset password";
}

function FieldIcon({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <div className={cn("mb-4 px-3.5 py-2.5 rounded-lg text-[13px] border",
      tone === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-[#EFF6FF] border-blue-200 text-blue-700")}>
      {children}
    </div>
  );
}
