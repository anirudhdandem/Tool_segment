import React, { useState } from "react";
import { KeyRound, User, Building, Check, Sparkles, Bell, Mail, Plus, Trash2, AlertCircle, Lock, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { Card, PageHeader, Button, Input, Field, Select, Badge, cn } from "../ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Provider keys managed from this UI (everything except Gemini). The `key`
// values match the backend's MANAGED_KEYS env names.
const PROVIDERS = [
  { key: "HUNTER_API_KEY", name: "Hunter.io", desc: "Email + people for a company domain" },
  { key: "TAVILY_API_KEY", name: "Tavily", desc: "Web research, domain discovery & company intel" },
  { key: "APOLLO_API_KEY", name: "Apollo.io", desc: "Full org chart — founders/CXOs/sales (optional, paid)" },
  { key: "RESEND_API_KEY", name: "Resend", desc: "Sends the industry-news email digest" },
];

export function Settings() {
  const s = useStore();
  const [tab, setTab] = useState("keys");
  const tabs = [
    { id: "keys", label: "API Keys", icon: KeyRound },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "prefs", label: "User Preferences", icon: User },
    { id: "workspace", label: "Workspace", icon: Building },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage integrations, preferences, and your workspace" />
      <div className="flex gap-6">
        <nav className="w-52 shrink-0 space-y-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] font-medium transition-colors",
                tab === t.id ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <t.icon className="size-4" />{t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 max-w-2xl space-y-4">
          {tab === "keys" && <KeysTab />}

          {tab === "notifications" && <NotificationsTab />}

          {tab === "prefs" && (
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">User Preferences</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full name"><Input defaultValue="Mitesh A." /></Field>
                <Field label="Email"><Input defaultValue="miteshai45@gmail.com" /></Field>
                <Field label="Default city"><Input defaultValue="New Delhi" /></Field>
                <Field label="Results per search"><Select defaultValue="50">{[25, 50, 100, 150, 200].map((n) => <option key={n}>{n}</option>)}</Select></Field>
              </div>
              <div className="flex justify-end pt-2"><Button variant="primary">Save preferences</Button></div>
            </Card>
          )}

          {tab === "workspace" && (
            <>
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Workspace</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Workspace name"><Input defaultValue="GTM Intelligence" /></Field>
                  <Field label="Region"><Select defaultValue="India"><option>India</option><option>Global</option></Select></Field>
                </div>
              </Card>
              <Card className="p-5 flex items-center justify-between bg-gradient-to-br from-secondary to-secondary/30 border-primary/10">
                <div className="flex items-center gap-3">
                  <span className="size-10 rounded-xl bg-primary/10 grid place-items-center text-primary"><Sparkles className="size-5" /></span>
                  <div>
                    <div className="font-semibold text-foreground">Scale plan</div>
                    <div className="text-[13px] text-muted-foreground">10,000 enrichments / mo · unlimited exports</div>
                  </div>
                </div>
                <Button variant="primary">Manage plan</Button>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KeysTab() {
  const s = useStore();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const statusOf = (key: string) => s.apiKeyStatus.find((k) => k.name === key);
  const dirty = Object.values(drafts).some((v) => v.trim().length > 0);

  const save = async () => {
    const patch: Record<string, string> = {};
    for (const [k, v] of Object.entries(drafts)) if (v.trim()) patch[k] = v.trim();
    if (!Object.keys(patch).length) return;
    setSaving(true); setErr(""); setSaved(false);
    const e = await s.saveApiKeys(patch);
    setSaving(false);
    if (e) { setErr(e); return; }
    setDrafts({}); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const clear = async (key: string) => {
    setSaving(true); setErr(""); setSaved(false);
    const e = await s.saveApiKeys({ [key]: "" });
    setSaving(false);
    setDrafts((p) => ({ ...p, [key]: "" }));
    if (e) setErr(e);
  };

  return (
    <>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Integrations & API Keys</h3>
        <p className="text-[13px] text-muted-foreground mb-4">Connect data providers to power discovery and enrichment. Keys are stored on your backend, never shown again in full.</p>
        <div className="space-y-4">
          {PROVIDERS.map((p) => {
            const st = statusOf(p.key);
            const connected = !!st?.configured;
            return (
              <div key={p.key} className="flex items-center gap-4">
                <div className="w-44 shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    {connected && <Badge tone="green"><Check className="size-3" />Connected</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.desc}</div>
                </div>
                <Input
                  type="password"
                  value={drafts[p.key] ?? ""}
                  onChange={(e) => { setDrafts((d) => ({ ...d, [p.key]: e.target.value })); setSaved(false); }}
                  placeholder={connected ? `Saved (${st?.hint}) · enter a new key to replace` : `${p.name} API key`}
                  className="flex-1"
                />
                {connected && (
                  <button onClick={() => clear(p.key)} disabled={saving} title="Remove key"
                    className="size-9 grid place-items-center rounded-md text-muted-foreground hover:text-[#DC2626] hover:bg-[#FEF2F2] shrink-0"><Trash2 className="size-4" /></button>
                )}
              </div>
            );
          })}
        </div>

        {/* Gemini is infra — configured in the backend .env, not here. */}
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
          <div className="w-44 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Google Gemini</span>
              <Badge tone="gray"><Lock className="size-3" />.env</Badge>
            </div>
            <div className="text-xs text-muted-foreground">The only LLM — structures profiles & contacts</div>
          </div>
          <div className="flex-1 text-[13px] text-muted-foreground">
            Managed in the backend <code className="font-mono text-[12px]">.env</code> (<code className="font-mono text-[12px]">GEMINI_API_KEY</code>).
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {err && <span className="text-[12px] text-red-600 flex items-center gap-1 mr-auto"><AlertCircle className="size-3.5" />{err}</span>}
        {saved && <span className="text-[12px] text-emerald-600 flex items-center gap-1 mr-auto"><Check className="size-3.5" />Keys saved</span>}
        <Button variant="primary" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save keys
        </Button>
      </div>
    </>
  );
}

function NotificationsTab() {
  const s = useStore();
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const email = input.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email address."); return; }
    if (s.newsRecipients.includes(email)) { setErr("That email is already on the list."); return; }
    setErr(""); setBusy(true);
    const e = await s.saveNewsConfig({ recipients: [...s.newsRecipients, email] });
    setBusy(false);
    if (e) setErr(e); else setInput("");
  };
  const remove = async (email: string) => {
    setBusy(true);
    await s.saveNewsConfig({ recipients: s.newsRecipients.filter((r) => r !== email) });
    setBusy(false);
  };
  const toggle = async () => {
    setBusy(true);
    await s.saveNewsConfig({ emailEnabled: !s.newsEmailEnabled });
    setBusy(false);
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />Industry-news email alerts</h3>
            <p className="text-[13px] text-muted-foreground">Important fintech/banking updates are emailed to everyone on this list (every 2 hours, only when something important lands).</p>
          </div>
          <button onClick={toggle} disabled={busy} role="switch" aria-checked={s.newsEmailEnabled}
            className={cn("shrink-0 mt-1 w-11 h-6 rounded-full relative transition-colors", s.newsEmailEnabled ? "bg-primary" : "bg-muted")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", s.newsEmailEnabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>

        {!s.newsProviderReady && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] text-[13px]">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>Email provider not connected yet — add your <b>Resend</b> key in <b>Settings → API Keys</b>. You can still add recipients now; they'll receive alerts once it's set.</span>
          </div>
        )}

        <div className="mt-4">
          <label className="text-[13px] font-medium text-foreground">Recipients</label>
          <div className="flex items-center gap-2 mt-1.5">
            <Input value={input} onChange={(e) => { setInput(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && add()} placeholder="name@company.com" className="flex-1" type="email" />
            <Button variant="primary" onClick={add} disabled={busy || !input.trim()}><Plus className="size-4" />Add</Button>
          </div>
          {err && <div className="text-[12px] text-red-600 mt-1.5 flex items-center gap-1"><AlertCircle className="size-3.5" />{err}</div>}

          <div className="mt-3 space-y-1.5">
            {s.newsRecipients.length === 0 ? (
              <div className="text-[13px] text-muted-foreground px-3 py-6 text-center border border-dashed border-border rounded-lg">No recipients yet. Add one or more emails above.</div>
            ) : s.newsRecipients.map((email) => (
              <div key={email} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card">
                <span className="size-7 rounded-full bg-secondary grid place-items-center text-primary shrink-0"><Mail className="size-3.5" /></span>
                <span className="text-[13px] text-foreground flex-1 truncate">{email}</span>
                <button onClick={() => remove(email)} disabled={busy} title="Remove"
                  className="size-7 grid place-items-center rounded-md text-muted-foreground hover:text-[#DC2626] hover:bg-[#FEF2F2]"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Badge tone={s.newsEmailEnabled && s.newsProviderReady && s.newsRecipients.length > 0 ? "green" : "gray"}>
          {!s.newsEmailEnabled ? "Alerts paused" : !s.newsProviderReady ? "Provider not set" : s.newsRecipients.length === 0 ? "No recipients" : "Alerts active"}
        </Badge>
        <span>Changes are saved automatically.</span>
      </div>
    </>
  );
}
