import React, { useMemo, useState } from "react";
import {
  Newspaper, RefreshCw, ExternalLink, CheckCheck, Flame, Building2,
  TrendingUp, Landmark, Sparkles, Filter,
} from "lucide-react";
import { useStore, type NewsItem } from "../store";
import { Card, PageHeader, Button, SearchInput, Select, Badge, EmptyState, cn } from "../ui";

const CATEGORIES = ["All", "funding", "M&A", "regulatory", "product", "leadership", "partnership"];
const SECTORS = ["All", "fintech", "banking", "nbfc", "payments", "lending", "insurtech", "wealthtech"];

function timeAgo(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const catTone = (c: string): any =>
  ({ funding: "green", "M&A": "violet", regulatory: "amber", product: "blue", leadership: "indigo", partnership: "gray" }[c] || "gray");

function ImportanceDot({ value, threshold }: { value: number; threshold: number }) {
  const hot = value >= threshold;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium tabular-nums", hot ? "text-rose-600" : "text-muted-foreground")}>
      {hot && <Flame className="size-3" />}{value}
    </span>
  );
}

export function IndustryNews() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sector, setSector] = useState("All");
  const [importantOnly, setImportantOnly] = useState(false);

  const rows = useMemo(() => s.news.filter((n) => {
    if (importantOnly && n.importance < s.importantThreshold) return false;
    if (cat !== "All" && n.category !== cat) return false;
    if (sector !== "All" && n.sector !== sector) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!n.title.toLowerCase().includes(t) && !(n.company || "").toLowerCase().includes(t) && !(n.summary || "").toLowerCase().includes(t)) return false;
    }
    return true;
  }), [s.news, q, cat, sector, importantOnly, s.importantThreshold]);

  return (
    <div>
      <PageHeader title="Industry News" subtitle="Live fintech & banking signals — funding, M&A, and regulatory updates"
        actions={
          <>
            <Button onClick={() => s.markNewsRead(undefined, true)} disabled={s.newsUnread === 0}><CheckCheck className="size-4" />Mark all read</Button>
            <Button variant="primary" onClick={s.refreshNews} disabled={s.newsRefreshing}>
              <RefreshCw className={cn("size-4", s.newsRefreshing && "animate-spin")} />{s.newsRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </>
        } />

      {/* summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={Newspaper} tone="#6366F1" label="Stories tracked" value={s.news.length} />
        <Stat icon={Flame} tone="#F59E0B" label="Important / unread" value={s.newsImportantUnread} />
        <Stat icon={TrendingUp} tone="#10B981" label="Funding stories" value={s.news.filter((n) => n.category === "funding").length} />
        <Stat icon={Landmark} tone="#6396E0" label="Regulatory" value={s.news.filter((n) => n.category === "regulatory").length} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="w-60"><SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news…" /></div>
          <div className="w-40"><Select value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>)}</Select></div>
          <div className="w-40"><Select value={sector} onChange={(e) => setSector(e.target.value)}>{SECTORS.map((c) => <option key={c} value={c}>{c === "All" ? "All sectors" : c}</option>)}</Select></div>
          <button onClick={() => setImportantOnly((v) => !v)}
            className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium border transition-colors",
              importantOnly ? "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]" : "bg-card text-muted-foreground border-border hover:bg-muted")}>
            <Flame className="size-4" />Important only
          </button>
          <div className="ml-auto text-xs text-muted-foreground">
            {s.newsLastRun ? `Updated ${timeAgo(s.newsLastRun)}` : "Awaiting first scan"}
          </div>
        </div>

        {s.newsLoading && s.news.length === 0 ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse">
                <div className="h-3.5 w-2/3 bg-muted rounded mb-2" /><div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Filter} title={s.news.length === 0 ? "No news yet" : "No stories match"}
            body={s.news.length === 0 ? "The watcher scans every 2 hours. Hit Refresh to pull the latest now." : "Try clearing filters or the search."}
            action={s.news.length === 0 ? <Button variant="primary" onClick={s.refreshNews} disabled={s.newsRefreshing}><RefreshCw className={cn("size-4", s.newsRefreshing && "animate-spin")} />Scan now</Button> : undefined} />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((n) => <Row key={n.id} n={n} threshold={s.importantThreshold} onOpen={() => !n.read && s.markNewsRead([n.id])} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className="size-9 rounded-lg grid place-items-center" style={{ background: `${tone}14`, color: tone }}><Icon className="size-[18px]" /></span>
      <div>
        <div className="text-xl font-semibold text-foreground tabular-nums leading-none">{value.toLocaleString()}</div>
        <div className="text-[12px] text-muted-foreground mt-1">{label}</div>
      </div>
    </Card>
  );
}

function Row({ n, threshold, onOpen }: { n: NewsItem; threshold: number; onOpen: () => void }) {
  return (
    <a href={n.url} target="_blank" rel="noreferrer" onClick={onOpen}
      className={cn("block px-5 py-4 hover:bg-muted/40 transition-colors", !n.read && "bg-secondary/30")}>
      <div className="flex items-start gap-3">
        {!n.read && <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />}
        <div className={cn("min-w-0 flex-1", n.read && "pl-5")}>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge tone={catTone(n.category)}>{n.category}</Badge>
            {n.company && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground"><Building2 className="size-3 text-muted-foreground" />{n.company}</span>}
            {n.amount && <Badge tone="green"><Sparkles className="size-3" />{n.amount}</Badge>}
            <ImportanceDot value={n.importance} threshold={threshold} />
          </div>
          <div className="text-[14px] font-medium text-foreground leading-snug flex items-start gap-1 group">
            <span className="group-hover:text-primary">{n.title}</span>
            <ExternalLink className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          </div>
          {n.summary && n.summary !== n.title && <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{n.summary}</div>}
          <div className="text-[12px] text-muted-foreground/80 mt-1.5">{n.source}{n.publishedAt ? ` · ${timeAgo(n.publishedAt)}` : ""} · <span className="capitalize">{n.sector}</span></div>
        </div>
      </div>
    </a>
  );
}
