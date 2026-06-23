import React, { useState } from "react";
import {
  LayoutDashboard, Radar, Building2, Users, Download, Settings as SettingsIcon,
  Bell, ChevronsUpDown, Newspaper, Info, AlertTriangle, CheckCircle2, Inbox,
} from "lucide-react";
import { LogOut, Loader2, Radar as RadarIcon } from "lucide-react";
import { StoreProvider, useStore, type Page } from "./store";
import { Avatar, cn } from "./ui";
import { CompanyDrawer } from "./CompanyDrawer";
import { AuthScreen } from "./pages/AuthScreen";
import { Dashboard } from "./pages/Dashboard";
import { LeadDiscovery } from "./pages/LeadDiscovery";
import { Companies } from "./pages/Companies";
import { Contacts } from "./pages/Contacts";
import { Exports } from "./pages/Exports";
import { IndustryNews } from "./pages/IndustryNews";
import { Settings } from "./pages/Settings";

const NAV: { id: Page; label: string; icon: any; group?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "discovery", label: "Lead Discovery", icon: Radar },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "exports", label: "Exports", icon: Download },
  { id: "news", label: "Industry News", icon: Newspaper },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar() {
  const s = useStore();
  const counts: Partial<Record<Page, number>> = {
    companies: s.companies.length, contacts: s.contacts.length, exports: s.exports.length,
    news: s.newsImportantUnread,
  };
  return (
    <aside className="w-[262px] shrink-0 h-screen bg-[#1E293B] border-r border-[#2C3A4F] flex flex-col">
      {/* brand */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.08]">
        <div className="size-10 rounded-[13px] bg-primary grid place-items-center text-white relative overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
          <Radar className="size-[20px]" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full" style={{ background: "var(--signal-amber)" }} />
        </div>
        <div>
          <div className="font-display text-[18px] font-semibold text-white leading-none tracking-[0.01em]">Prospio</div>
          <div className="font-mono text-[10px] text-[#94A3B8] mt-1.5 uppercase tracking-[0.24em]">Signal Desk</div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3 py-8 space-y-5 overflow-y-auto no-scrollbar">
        <div className="px-3 pb-4 font-mono text-[10px] font-medium text-[#64748B] uppercase tracking-[0.2em]">Workspace</div>
        {NAV.map((item) => {
          const active = s.page === item.id;
          const count = counts[item.id];
          return (
            <button key={item.id} onClick={() => s.setPage(item.id)}
              className={cn("group w-full flex items-center gap-3.5 pl-4 pr-3 h-[52px] rounded-xl text-[14.5px] font-medium transition-colors relative",
                active ? "bg-white/[0.08] text-white" : "text-[#CBD5E1] hover:bg-white/[0.06] hover:text-white")}>
              <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-[#818CF8] transition-opacity",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
              <item.icon className={cn("size-[20px] transition-colors", active ? "text-[#A5B4FC]" : "text-[#94A3B8] group-hover:text-[#CBD5E1]")} />
              <span className="flex-1 text-left">{item.label}</span>
              {count != null && count > 0 && (
                item.id === "news"
                  ? <span className="min-w-[18px] h-[18px] px-1.5 grid place-items-center rounded-full bg-[#EF4444] text-white font-mono text-[10px] font-semibold leading-none tabular-nums shadow-[0_0_0_3px_rgba(239,68,68,0.18)]">{count > 99 ? "99+" : count}</span>
                  : <span className={cn("font-mono text-[11px] tabular-nums px-1.5 rounded-md", active ? "bg-white/15 text-white" : "bg-white/[0.07] text-[#94A3B8]")}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* user */}
      <div className="p-3 border-t border-white/[0.08]">
        <button className="w-full flex items-center gap-3 px-2 h-12 rounded-[10px] hover:bg-white/[0.06] transition-colors">
          <Avatar name="Mitesh A" size={34} />
          <div className="flex-1 text-left min-w-0">
            <div className="text-[13px] font-medium text-white truncate">Mitesh A.</div>
            <div className="text-[11px] text-[#94A3B8] truncate">GTM Intelligence</div>
          </div>
          <ChevronsUpDown className="size-4 text-[#94A3B8]" />
        </button>
      </div>
    </aside>
  );
}

type NotifType = "info" | "alert" | "success";
const NOTIF_STYLE: Record<NotifType, { icon: any; fg: string; bg: string }> = {
  info: { icon: Info, fg: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  alert: { icon: AlertTriangle, fg: "#B45309", bg: "rgba(245,158,11,0.13)" },
  success: { icon: CheckCircle2, fg: "#047857", bg: "rgba(5,150,105,0.12)" },
};

// Hardcoded sample notifications (UI only — wire to a real feed later).
const SAMPLE_NOTIFS: { id: string; type: NotifType; title: string; time: string; read: boolean }[] = [
  { id: "n1", type: "success", title: "Enrichment complete — 48 companies enriched in “DSA for Loans · New Delhi”", time: "2m ago", read: false },
  { id: "n2", type: "alert", title: "Hunter API credits running low — 12% remaining this cycle", time: "1h ago", read: false },
  { id: "n3", type: "info", title: "New funding signals available for 3 saved Fintech companies", time: "3h ago", read: false },
  { id: "n4", type: "success", title: "Export ready: Wealth Management · Mumbai (120 leads)", time: "Yesterday", read: true },
  { id: "n5", type: "info", title: "Your weekly prospecting digest is ready to review", time: "2d ago", read: true },
];

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(SAMPLE_NOTIFS);
  const unread = items.filter((n) => !n.read).length;
  const markAll = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const markOne = (id: string) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Notifications" aria-expanded={open}
        className="size-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted relative">
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full text-[#2a1a06] font-mono text-[10px] font-semibold tabular-nums" style={{ background: "var(--signal-amber)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[372px] bg-popover border border-border rounded-xl shadow-[0_18px_50px_rgba(16,24,40,0.16)] z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="font-display text-[15px] font-semibold text-foreground">Notifications</div>
            {unread > 0 && (
              <button onMouseDown={(e) => { e.preventDefault(); markAll(); }} className="text-xs font-medium text-primary hover:underline">Mark all read</button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center text-center gap-2.5">
              <span className="size-12 rounded-full bg-muted grid place-items-center text-muted-foreground"><Inbox className="size-6" /></span>
              <div className="text-[13px] font-medium text-foreground">You're all caught up</div>
              <div className="text-[12px] text-muted-foreground">New activity will show up here.</div>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto thin-scroll divide-y divide-border">
              {items.map((n) => {
                const cfg = NOTIF_STYLE[n.type];
                const Icon = cfg.icon;
                return (
                  <button key={n.id} onMouseDown={() => markOne(n.id)}
                    className={cn("w-full text-left px-4 py-3 flex gap-3 hover:bg-muted transition-colors", !n.read && "bg-secondary/50")}>
                    <span className="mt-0.5 size-8 shrink-0 rounded-lg grid place-items-center" style={{ background: cfg.bg, color: cfg.fg }}>
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground leading-snug">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">{n.time}</div>
                    </div>
                    {!n.read && <span className="mt-1.5 size-2 rounded-full shrink-0" style={{ background: cfg.fg }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const u = s.user;
  if (!u) return null;
  const display = u.name?.trim() || u.email.split("@")[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-lg hover:bg-muted transition-colors">
        <Avatar name={display} size={28} />
        <span className="max-w-[140px] truncate text-[13px] font-medium text-foreground hidden sm:block">{display}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[248px] bg-popover border border-border rounded-xl shadow-[0_18px_50px_rgba(16,24,40,0.16)] z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[13px] font-semibold text-foreground truncate">{display}</div>
            <div className="text-[12px] text-muted-foreground truncate">{u.email}</div>
          </div>
          <button onMouseDown={(e) => { e.preventDefault(); s.logout(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="size-4" />Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Topbar() {
  const s = useStore();
  return (
    <header className="h-16 shrink-0 bg-card/80 backdrop-blur border-b border-border sticky top-0 z-20">
      <div className="h-full max-w-[1760px] mx-auto px-10 flex items-center gap-4">
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => s.setPage("discovery")} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-[filter] shadow-[0_6px_20px_rgba(99,102,241,0.22)]">
            <Radar className="size-4" />New Search
          </button>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function Pages() {
  const { page } = useStore();
  switch (page) {
    case "dashboard": return <Dashboard />;
    case "discovery": return <LeadDiscovery />;
    case "companies": return <Companies />;
    case "contacts": return <Contacts />;
    case "exports": return <Exports />;
    case "news": return <IndustryNews />;
    case "settings": return <Settings />;
  }
}

function Shell() {
  return (
    <div className="flex h-screen bg-background text-foreground antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto thin-scroll">
          <div className="max-w-[1760px] mx-auto px-10 py-7">
            <Pages />
          </div>
        </main>
      </div>
      <CompanyDrawer />
    </div>
  );
}

/** Decides what to render based on auth: splash → login → app. */
function Gate() {
  const { user, authReady } = useStore();
  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-11 rounded-[13px] bg-primary grid place-items-center text-white shadow-[0_8px_24px_rgba(79,70,229,0.30)]">
            <RadarIcon className="size-[22px]" />
          </div>
          <Loader2 className="size-5 animate-spin" />
        </div>
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  return <Shell />;
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  );
}
