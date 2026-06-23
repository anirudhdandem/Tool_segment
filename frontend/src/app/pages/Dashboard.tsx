import React from "react";
import {
  Building2, Users, Mail, Search, Download,
  ArrowUpRight, Clock, Sparkles, ChevronRight,
} from "lucide-react";
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore, clean } from "../store";
import { Card, Avatar, Badge, Button } from "../ui";

/** KPI tile — distinct accent per metric type via a colored left rule + tinted icon. */
function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <Card className="p-4 pl-[18px] border-l-[3px]" style={{ borderLeftColor: tone }}>
      <div className="size-9 rounded-lg grid place-items-center" style={{ background: `${tone}16`, color: tone }}>
        <Icon className="size-[18px]" />
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold text-foreground tracking-tight tabular-nums">{value}</div>
      <div className="text-[13px] text-muted-foreground mt-0.5">{label}</div>
    </Card>
  );
}

function TrendCard({ title, data, color, total }: { title: string; data: { label: string; value: number }[]; color: string; total: string }) {
  const id = title.replace(/\s/g, "");
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
          <div className="font-mono text-2xl font-semibold text-foreground tracking-tight mt-1.5 tabular-nums">{total}</div>
        </div>
        <Badge tone="green"><ArrowUpRight className="size-3" />Last 14 days</Badge>
      </div>
      <div className="h-[200px] -mx-1 rounded-lg bg-[linear-gradient(to_bottom,rgba(99,102,241,0.04),transparent)]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(16,24,40,0.06)" strokeDasharray="2 5" vertical horizontal />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9AA3B2", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} interval={2} />
            <YAxis hide domain={[0, "dataMax + 20"]} />
            <Tooltip
              cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.35 }}
              contentStyle={{ borderRadius: 10, background: "#FFFFFF", border: "1px solid #E6E8EF", boxShadow: "0 8px 24px rgba(16,24,40,0.10)", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}
              labelStyle={{ color: "#6B7280" }} itemStyle={{ color: "#1F2433" }} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Section card whose body falls back to an icon + one-line action prompt when empty. */
function ActivityCard({ icon: Icon, title, onViewAll, empty, emptyIcon: EmptyIcon, emptyPrompt, onEmptyClick, children }: {
  icon: any; title: string; onViewAll: () => void; empty: boolean; emptyIcon: any; emptyPrompt: string; onEmptyClick: () => void; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Icon className="size-4 text-muted-foreground" />{title}</h3>
        <button onClick={onViewAll} className="text-xs text-primary font-medium hover:underline">View all</button>
      </div>
      {empty ? (
        <button onClick={onEmptyClick} className="group flex-1 px-5 py-9 flex flex-col items-center justify-center text-center gap-2.5">
          <span className="size-10 rounded-xl bg-muted grid place-items-center text-muted-foreground group-hover:text-primary group-hover:bg-secondary transition-colors">
            <EmptyIcon className="size-[19px]" />
          </span>
          <span className="text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">
            {emptyPrompt} <span className="text-primary font-medium">→</span>
          </span>
        </button>
      ) : (
        <div className="divide-y divide-border">{children}</div>
      )}
    </Card>
  );
}

const PLACEHOLDER_CATEGORIES = ["Wealth Management", "Fintech", "Insurance", "Commercial Lending", "Payments", "RIAs", "Private Equity"];

export function Dashboard() {
  const s = useStore();
  const emails = s.companies.filter((c) => clean(c.email)).length;
  const exportedLeads = s.exports.reduce((a, e) => a + e.companies, 0);
  const maxCat = Math.max(...s.topCategories.map((c) => c.value), 1);
  const recentEnriched = s.companies.filter((c) => c.status === "enriched").slice(0, 5);
  const catColors = ["#6366F1", "#10B981", "#6396E0", "#8B5CF6", "#F59E0B", "#EC4899"];

  return (
    <div>
      {/* header — calm serif greeting */}
      <div className="flex items-start justify-between gap-4 mb-7">
        <div className="flex gap-3.5">
          <span className="mt-1 w-[3px] self-stretch rounded-full bg-primary" aria-hidden />
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2.5">Workspace / Overview</div>
            <h1 className="font-display text-[34px] font-medium text-foreground tracking-[-0.01em] leading-none">Dashboard</h1>
            <p className="font-display text-[16px] text-muted-foreground mt-3">Your prospecting activity at a glance</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => s.setPage("discovery")}><Search className="size-4" />New Search</Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi icon={Building2} label="Total Companies" value={s.companies.length.toLocaleString()} tone="#6396E0" />
        <Kpi icon={Users} label="Total Contacts" value={s.contacts.length.toLocaleString()} tone="#8B5CF6" />
        <Kpi icon={Mail} label="Emails Found" value={emails.toLocaleString()} tone="#10B981" />
        <Kpi icon={Download} label="Exported Leads" value={exportedLeads.toLocaleString()} tone="#EC4899" />
      </div>

      {/* charts (wide) + categories sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-5">
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <TrendCard title="Leads Discovered" data={s.leadsSeries} color="#6366F1" total={s.leadsSeries.reduce((a, p) => a + p.value, 0).toLocaleString()} />
          <TrendCard title="Contacts Enriched" data={s.contactsSeries} color="#10B981" total={s.contactsSeries.reduce((a, p) => a + p.value, 0).toLocaleString()} />
        </div>
        <Card className="lg:col-span-4 p-5 flex flex-col">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-4">Top Categories Searched</h3>
          {s.topCategories.length > 0 ? (
            <div className="space-y-3.5">
              {s.topCategories.map((c, i) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <span className="text-foreground font-medium truncate">{c.label}</span>
                    <span className="font-mono text-muted-foreground tabular-nums">{c.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(c.value / maxCat) * 100}%`, background: catColors[i % catColors.length] }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <p className="text-[13px] text-muted-foreground leading-relaxed">Categories surface here as you run searches. Common segments for this desk:</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {PLACEHOLDER_CATEGORIES.map((c) => (
                  <span key={c} className="px-2.5 py-1 rounded-full border border-dashed border-border bg-muted/40 text-[12px] text-muted-foreground">{c}</span>
                ))}
              </div>
              <button onClick={() => s.setPage("discovery")} className="mt-auto pt-5 text-[13px] text-primary font-medium hover:underline text-left">Run a search to populate →</button>
            </div>
          )}
        </Card>
      </div>

      {/* recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActivityCard icon={Clock} title="Recent Searches" onViewAll={() => s.setPage("discovery")}
          empty={s.searchHistory.length === 0} emptyIcon={Search} emptyPrompt="Run your first search" onEmptyClick={() => s.setPage("discovery")}>
          {s.searchHistory.slice(0, 5).map((h) => (
            <button key={h.id} onClick={() => s.loadSearch(h.id)} className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate group-hover:text-primary">{h.query}</div>
                <div className="text-xs text-muted-foreground">{h.location} · {h.at}</div>
              </div>
              <Badge tone="indigo">{h.results}</Badge>
            </button>
          ))}
        </ActivityCard>

        <ActivityCard icon={Sparkles} title="Recently Enriched" onViewAll={() => s.setPage("companies")}
          empty={recentEnriched.length === 0} emptyIcon={Sparkles} emptyPrompt="Enrich a company to see it here" onEmptyClick={() => s.setPage("companies")}>
          {recentEnriched.map((c) => (
            <button key={c.id} onClick={() => s.openCompany(c.id)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-muted text-left">
              <Avatar name={c.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.category}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </ActivityCard>

        <ActivityCard icon={Download} title="Recent Exports" onViewAll={() => s.setPage("exports")}
          empty={s.exports.length === 0} emptyIcon={Download} emptyPrompt="Export a list to see it here" onEmptyClick={() => s.setPage("exports")}>
          {s.exports.slice(0, 5).map((e) => (
            <div key={e.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-foreground">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.companies} companies · {e.date}</div>
              </div>
              <Badge tone="gray">{e.format}</Badge>
            </div>
          ))}
        </ActivityCard>
      </div>
    </div>
  );
}
