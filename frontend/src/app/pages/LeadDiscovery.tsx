import React, { useMemo, useState } from "react";
import {
  Search, SlidersHorizontal, Star, ExternalLink, Eye, Bookmark, Zap,
  ListPlus, Download, Radar, Check, AlertCircle, Loader2,
  ChevronDown, MapPin, Banknote, Users, ArrowRight, Pencil, Trash2, Building2, TrendingUp,
} from "lucide-react";
import { useStore, clean, SEGMENTS, STATES_CITIES, ALL_INDIA, type Company } from "../store";
import {
  Card, Button, Field, Select, Input, Badge, Score, StatusPill,
  Avatar, TableSkeleton, cn,
} from "../ui";
import { downloadCompaniesCsv, hostOf } from "../util";

const COLS = ["Company", "Category", "Volume / Scale", "Location", "Phone", "Website", "Rating", "Reviews", "Company Size", "Funding", "Lead Score", "Status", ""];

// stable per-segment accent (default segment lands on teal)
const SEG_COLORS = ["#6366F1", "#6396E0", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#14B8A6"];
const segColor = (seg: string) => SEG_COLORS[Math.max(0, SEGMENTS.indexOf(seg)) % SEG_COLORS.length];

const WHAT_WE_FIND = [
  { icon: MapPin, title: "Companies via Google Maps", sub: "Real businesses matched to your segment & location" },
  { icon: Banknote, title: "Funding & size data", sub: "Rounds, headcount and growth signals per company" },
  { icon: Users, title: "Decision makers & emails", sub: "Verified contacts at each company, ready to reach" },
];

export function LeadDiscovery() {
  const s = useStore();
  const [mode, setMode] = useState<"segment" | "name" | "top">("segment");
  const [companyName, setCompanyName] = useState("");
  const [nameLocation, setNameLocation] = useState("");
  const [topQuery, setTopQuery] = useState("");
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [customQuery, setCustomQuery] = useState("");
  const [stateName, setStateName] = useState("Delhi");
  const [city, setCity] = useState("New Delhi");
  const [pincode, setPincode] = useState("");
  const [radius, setRadius] = useState("10 KM");
  const [maxResults, setMaxResults] = useState(50);
  const [searchName, setSearchName] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quick, setQuick] = useState("");

  // advanced filters
  const [fIndustry, setFIndustry] = useState("Any");
  const [fFunding, setFFunding] = useState("Any");
  const [fSize, setFSize] = useState("Any");
  const [fWebsite, setFWebsite] = useState(false);
  const [fEmail, setFEmail] = useState(false);
  const [fContact, setFContact] = useState(false);
  const [fRating, setFRating] = useState(0);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSelected(new Set());
    try {
      if (mode === "name") {
        const cn = companyName.trim();
        if (!cn) { setError("Enter a company name to search."); return; }
        // Company-name search: query the name directly, location optional.
        await s.runDiscovery({ segment: "", customQuery: cn, city: nameLocation.trim(), pincode: "", radius: "", maxResults, name: searchName });
      } else if (mode === "top") {
        const tq = topQuery.trim();
        if (!tq) { setError("Describe the ranking, e.g. \"top 10 fintech companies in India\"."); return; }
        // Count comes from the prompt ("top 10" → 10); 10 if none given.
        const m = tq.match(/\b(\d{1,3})\b/);
        const count = m ? Math.min(Math.max(parseInt(m[1], 10), 1), 50) : 10;
        // Top-companies: AI-ranked national list (no city, no Maps scrape).
        await s.runDiscovery({ segment: "", customQuery: tq, city: "", pincode: "", radius: "", maxResults: count, name: searchName, mode: "top" });
      } else {
        // Resolve the geographic scope: "All India" → national, "All <State>" →
        // whole state, otherwise the chosen city. The backend scopes the Maps
        // query as "<term> in <effCity>" (empty/national handled there too).
        const effCity = stateName === ALL_INDIA
          ? "India"
          : city === `All ${stateName}` ? `${stateName}, India` : city;
        await s.runDiscovery({ segment, customQuery, city: effCity, pincode, radius, maxResults, name: searchName });
      }
    }
    catch (err: any) { setError(err.message || "Search failed"); }
  };

  const filtered = useMemo(() => s.discovery.filter((c) => {
    if (quick) { const q = quick.toLowerCase(); if (!c.name.toLowerCase().includes(q) && !(c.address || "").toLowerCase().includes(q) && !clean(c.email).toLowerCase().includes(q)) return false; }
    if (fWebsite && !clean(c.website)) return false;
    if (fEmail && !clean(c.email)) return false;
    if (fContact && !clean(c.contactName)) return false;
    if (fIndustry !== "Any" && c.category !== fIndustry) return false;
    if (fFunding === "Funded" && !/\$|raised|series|listed|cr/i.test(clean(c.funding))) return false;
    if (fFunding === "Bootstrapped" && !/bootstrap|self/i.test(clean(c.funding))) return false;
    if (fSize !== "Any" && !clean(c.companySize)) return false;
    const r = parseFloat(c.rating || ""); if (fRating > 0 && (isNaN(r) || r < fRating)) return false;
    return true;
  }), [s.discovery, quick, fWebsite, fEmail, fContact, fIndustry, fFunding, fSize, fRating]);

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(filtered.map((c) => c.id)));

  const exportSel = () => {
    const rows = selected.size ? filtered.filter((c) => selected.has(c.id)) : filtered;
    const name = `${customQuery.trim() || segment}_${city}`;
    downloadCompaniesCsv(name, rows);
    s.recordExport(`${customQuery.trim() || segment} · ${city}`, rows.map((c) => c.id), "CSV");
  };

  const showSkeleton = s.discovering && s.discovery.length === 0;

  return (
    <div>
      {/* header with step-by-step workflow subtitle */}
      <div className="flex items-start gap-3 mb-6">
        <span className="mt-1 w-[3px] self-stretch rounded-full bg-primary" aria-hidden />
        <div>
          <h1 className="font-display text-[30px] font-medium text-foreground tracking-[-0.01em] leading-none">Lead Discovery</h1>
          <div className="flex items-center gap-2 mt-2.5 font-mono text-[13px]">
            {["Search", "Enrich", "Export"].map((step, i) => (
              <React.Fragment key={step}>
                {i > 0 && <ArrowRight className="size-3.5 text-primary/70" />}
                <span className="font-medium text-foreground">{step}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* search panel — teal top rule = "signal active", subtle inner shadow */}
      <Card className="p-5 mb-4 border-t-[3px] border-t-primary shadow-[inset_0_2px_12px_rgba(99,102,241,0.07),0_1px_2px_rgba(0,0,0,0.3)]">
        <form onSubmit={run}>
          {/* search mode — by segment+location, or by a specific company name */}
          <div className="mb-4 inline-flex p-1 rounded-xl bg-muted border border-border">
            {([["segment", "By segment", Radar], ["name", "By company name", Building2], ["top", "Top companies", TrendingUp]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => { setMode(id); setError(""); }}
                className={cn("inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors",
                  mode === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Icon className="size-4" />{label}
              </button>
            ))}
          </div>

          {mode === "segment" && (<>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="block">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[13px] font-medium text-foreground">Segment</span>
                {!customQuery.trim() && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium max-w-[150px]"
                    style={{ background: `${segColor(segment)}1a`, color: segColor(segment) }}>
                    <span className="size-1.5 rounded-full shrink-0" style={{ background: segColor(segment) }} />
                    <span className="truncate">{segment}</span>
                  </span>
                )}
              </div>
              <Select value={segment} onChange={(e) => setSegment(e.target.value)} disabled={!!customQuery.trim()}>{SEGMENTS.map((x) => <option key={x}>{x}</option>)}</Select>
            </div>
            <Field label="Custom search query" hint={customQuery.trim() ? `Searching exactly: "${customQuery.trim()}"` : "Overrides segment"}>
              <Input value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder="e.g. home loan DSA in Dwarka" />
            </Field>
            <Field label="State"><Select value={stateName} onChange={(e) => { const st = e.target.value; setStateName(st); setCity(st === ALL_INDIA ? "" : `All ${st}`); }}>{[ALL_INDIA, ...Object.keys(STATES_CITIES)].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="City" hint={stateName === ALL_INDIA ? "Searching all of India" : undefined}><Select value={city} disabled={stateName === ALL_INDIA} onChange={(e) => setCity(e.target.value)}>{stateName === ALL_INDIA ? <option value="">Across India</option> : [`All ${stateName}`, ...(STATES_CITIES[stateName] || [])].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Pincode"><Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="Optional · 110001" /></Field>
            <Field label="Radius"><Select value={radius} onChange={(e) => setRadius(e.target.value)}>{["5 KM", "10 KM", "20 KM", "50 KM"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Maximum results"><Select value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))}>{[25, 50, 100, 150, 200].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          </div>

          {/* advanced filters — disclosure */}
          <div className="mt-4">
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}
              className={cn("group inline-flex items-center gap-2 h-9 -ml-1 px-2 rounded-lg text-[13px] font-medium transition-colors",
                showFilters ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <SlidersHorizontal className="size-4" />
              Advanced filters
              <ChevronDown className={cn("size-4 transition-transform duration-300 ease-out", showFilters && "rotate-180")} />
            </button>
          </div>

          <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Industry"><Select value={fIndustry} onChange={(e) => setFIndustry(e.target.value)}><option>Any</option>{SEGMENTS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
                <Field label="Company size"><Select value={fSize} onChange={(e) => setFSize(e.target.value)}>{["Any", "1–10", "11–50", "51–200", "201–1000", "1000+"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
                <Field label="Funding status"><Select value={fFunding} onChange={(e) => setFFunding(e.target.value)}>{["Any", "Funded", "Bootstrapped"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
                <Field label="Minimum rating"><Select value={fRating} onChange={(e) => setFRating(Number(e.target.value))}>{[0, 3, 3.5, 4, 4.5].map((n) => <option key={n} value={n}>{n === 0 ? "Any" : `${n}★ +`}</option>)}</Select></Field>
                <div className="col-span-2 md:col-span-4 flex flex-wrap items-center gap-2">
                  {[["Has website", fWebsite, setFWebsite], ["Has email", fEmail, setFEmail], ["Has contact person", fContact, setFContact]].map(([label, val, set]: any) => (
                    <button key={label} type="button" onClick={() => set(!val)}
                      className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium border transition-colors",
                        val ? "bg-secondary text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:bg-muted")}>
                      <span className={cn("size-3.5 rounded grid place-items-center border", val ? "bg-primary border-primary" : "border-border")}>{val && <Check className="size-2.5 text-white" />}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </>)}

          {mode === "name" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Company name" hint="The business you're looking for">
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Blostem" autoFocus />
              </Field>
              <Field label="Location" hint="Optional · narrows to one place">
                <Input value={nameLocation} onChange={(e) => setNameLocation(e.target.value)} placeholder="Optional · e.g. New Delhi" />
              </Field>
              <Field label="Maximum results"><Select value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))}>{[25, 50, 100, 150, 200].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
            </div>
          )}

          {mode === "top" && (
            <>
              <Field label="What ranking do you want?" hint="Include the count in the prompt (e.g. “top 10…”). AI researches the web & ranks by volume / turnover / market share.">
                <Input value={topQuery} onChange={(e) => setTopQuery(e.target.value)} placeholder='e.g. top 10 fintech companies in India · top 5 stock brokers by turnover' autoFocus />
              </Field>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Try:</span>
                {["top 10 fintech companies in India", "top 5 stock brokers in India by turnover", "top UPI apps in India by volume", "top 10 NBFCs in India by AUM"].map((ex) => (
                  <button key={ex} type="button" onClick={() => setTopQuery(ex)}
                    className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors">{ex}</button>
                ))}
              </div>
            </>
          )}

          {/* name + primary action — full-width on mobile, large & prominent on desktop */}
          <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-foreground mb-1.5">Save this search as <span className="text-muted-foreground font-normal">· reloadable after refresh</span></span>
              <Input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder={mode === "name" ? (companyName.trim() || "Company name") + (nameLocation.trim() ? ` · ${nameLocation.trim()}` : "") : mode === "top" ? (topQuery.trim() || "Top companies") : `${customQuery.trim() || segment} · ${city}`} />
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto sm:min-w-[220px]" disabled={s.discovering}>
              {s.discovering ? <><Loader2 className="size-[18px] animate-spin" />{s.discoveryPhase === "enriching" && s.discoveryProgress ? `Enriching ${s.discoveryProgress.done}/${s.discoveryProgress.total}` : "Discovering…"}</> : <><Search className="size-[18px]" />Search companies</>}
            </Button>
          </div>
        </form>
      </Card>

      {s.savedSearches.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Bookmark className="size-4 text-muted-foreground" />Saved searches</h3>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{s.savedSearches.length}</span>
          </div>
          <div className="divide-y divide-border max-h-[280px] overflow-y-auto thin-scroll">
            {s.savedSearches.map((ss) => (
              <div key={ss.id} className="group px-5 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                <button onClick={() => s.loadSearch(ss.id)} className="flex-1 text-left min-w-0">
                  <div className="text-[13.5px] font-medium text-foreground truncate group-hover:text-primary">{ss.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-foreground/80 font-medium max-w-[220px] shrink-0">
                      <Search className="size-3 text-primary/70" />
                      <span className="truncate">{ss.query?.trim() || ss.segment || "—"}</span>
                    </span>
                    <span className="truncate">
                      {ss.city ? <><MapPin className="inline size-3 -mt-0.5" /> {ss.city} · </> : null}
                      {new Date(ss.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </button>
                <Badge tone="indigo">{ss.companyCount} cos</Badge>
                <button onClick={() => { const n = window.prompt("Rename search", ss.name); if (n && n.trim()) s.renameSearch(ss.id, n.trim()); }}
                  title="Rename" className="size-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-4" /></button>
                <button onClick={() => { if (window.confirm(`Delete saved search "${ss.name}"?`)) s.deleteSearch(ss.id); }}
                  title="Delete" className="size-7 grid place-items-center rounded-md text-muted-foreground hover:bg-[#FEF2F2] hover:text-[#DC2626]"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm">
          <AlertCircle className="size-4 shrink-0" /><span><b>Search error</b> — {error}</span>
        </div>
      )}

      {/* results */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {s.discovery.length > 0 ? `${filtered.length} results` : "Results"}
            </h3>
            {s.discovering && <Badge tone="amber"><Loader2 className="size-3 animate-spin" />{s.discoveryPhase === "enriching" ? "Enriching" : "Scanning"}</Badge>}
            {s.discoveryProgress && <span className="text-xs text-muted-foreground tabular-nums">{s.discoveryProgress.done}/{s.discoveryProgress.total} enriched</span>}
          </div>
          {s.discovery.length > 0 && (
            <div className="flex items-center gap-2">
              <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Filter results…" className="w-48 h-8" />
              <Button size="sm" onClick={exportSel}><Download className="size-4" />Export</Button>
            </div>
          )}
        </div>

        {/* ranking basis (top-companies mode) */}
        {s.discoveryBasis && (
          <div className="px-5 py-2.5 bg-secondary/40 border-b border-border flex items-center gap-2 text-[13px]">
            <TrendingUp className="size-4 text-primary shrink-0" />
            <span className="text-foreground font-medium">{s.discoveryBasis}</span>
            <span className="text-muted-foreground">· see the Volume / Scale column · figures are AI estimates</span>
          </div>
        )}

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className="px-5 py-2.5 bg-secondary/60 border-b border-border flex items-center gap-3">
            <span className="text-[13px] font-medium text-primary">{selected.size} selected</span>
            <div className="h-4 w-px bg-border" />
            <Button size="sm" onClick={() => { s.addToList(s.lists[0]?.id, [...selected]); }}><ListPlus className="size-4" />Add to {s.lists[0]?.name || "list"}</Button>
            <Button size="sm" onClick={exportSel}><Download className="size-4" />Export selected</Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        {showSkeleton ? (
          <TableSkeleton rows={8} cols={7} />
        ) : s.discovery.length === 0 ? (
          <div className="grid md:grid-cols-2 gap-px bg-border">
            {/* left — what we'll find */}
            <div className="bg-card px-6 sm:px-8 py-10">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-5">What we'll find</div>
              <ul className="space-y-5">
                {WHAT_WE_FIND.map(({ icon: Icon, title, sub }) => (
                  <li key={title} className="flex gap-3.5">
                    <span className="size-9 shrink-0 rounded-lg bg-secondary grid place-items-center text-primary"><Icon className="size-[18px]" /></span>
                    <div>
                      <div className="text-[14px] font-medium text-foreground">{title}</div>
                      <div className="text-[13px] text-muted-foreground mt-0.5 leading-snug">{sub}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* right — CTA */}
            <div className="bg-card px-6 sm:px-8 py-12 flex flex-col items-center justify-center text-center">
              <span className="size-14 rounded-2xl bg-primary/10 grid place-items-center text-primary mb-4"><Radar className="size-7" /></span>
              <h3 className="text-[17px] font-semibold text-foreground">Start discovering companies</h3>
              <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[280px]">Pick a segment and location above, then run a search to build your list.</p>
              <Button variant="primary" size="lg" className="mt-5" onClick={() => (document.querySelector("input,select") as HTMLElement)?.focus()}><Search className="size-[18px]" />Run your first search</Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="pl-5 pr-2 py-2.5 w-9"><input type="checkbox" checked={allOn} onChange={toggleAll} className="accent-[var(--primary)]" /></th>
                  {COLS.map((c) => <th key={c} className="px-3 py-2.5 whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c, i) => <Row key={c.id} c={c} rank={s.discoveryBasis ? i + 1 : undefined} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} justResolved={s.resolved.has(c.id) && s.discovering} onView={() => s.openCompany(c.id)} addToList={() => s.addToList(s.lists[0]?.id, [c.id])} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function val(v?: string) {
  return clean(v) ? <span className="text-foreground">{clean(v)}</span> : <span className="text-muted-foreground/60">—</span>;
}

function Row({ c, rank, selected, onToggle, justResolved, onView, addToList }: {
  c: Company; rank?: number; selected: boolean; onToggle: () => void; justResolved: boolean; onView: () => void; addToList: () => void;
}) {
  const host = hostOf(c.website);
  return (
    <tr className={cn("hover:bg-muted/40 transition-colors", selected && "bg-secondary/40")}>
      <td className="pl-5 pr-2 py-3"><input type="checkbox" checked={selected} onChange={onToggle} className="accent-[var(--primary)]" /></td>
      <td className="px-3 py-3">
        <button onClick={onView} className="flex items-center gap-2.5 text-left group">
          {rank != null && <span className="shrink-0 size-6 grid place-items-center rounded-md bg-secondary text-primary text-[12px] font-semibold tabular-nums">{rank}</span>}
          <Avatar name={c.name} size={30} />
          <div className="min-w-0">
            <div className="font-medium text-foreground group-hover:text-primary truncate max-w-[180px]">{c.name}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{c.city}</div>
          </div>
        </button>
      </td>
      <td className="px-3 py-3"><Badge tone="indigo">{c.category}</Badge></td>
      <td className="px-3 py-3 max-w-[180px]"><div className="truncate" title={clean(c.transactionVolume)}>{val(c.transactionVolume)}</div></td>
      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{c.city || "—"}</td>
      <td className="px-3 py-3 whitespace-nowrap">{val(c.phone)}</td>
      <td className="px-3 py-3">{host ? <a href={c.website} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">{host}<ExternalLink className="size-3" /></a> : <span className="text-muted-foreground/60">—</span>}</td>
      <td className="px-3 py-3">{clean(c.rating) ? <span className="inline-flex items-center gap-1 text-foreground"><Star className="size-3.5 fill-amber-400 text-amber-400" />{c.rating}</span> : <span className="text-muted-foreground/60">—</span>}</td>
      <td className="px-3 py-3 text-muted-foreground tabular-nums">{clean(c.reviewCount) || "—"}</td>
      <td className="px-3 py-3 max-w-[160px]"><div className="truncate" title={clean(c.companySize)}>{val(c.companySize)}</div></td>
      <td className="px-3 py-3 max-w-[160px]"><div className="truncate" title={clean(c.funding)}>{val(c.funding)}</div></td>
      <td className="px-3 py-3"><Score value={c.score} /></td>
      <td className="px-3 py-3">{justResolved ? <Badge tone="green"><Check className="size-3" />Resolved</Badge> : <StatusPill status={c.status} />}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-0.5">
          <button onClick={onView} title="View details" className="size-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="size-4" /></button>
          <button title="Save" className="size-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Bookmark className="size-4" /></button>
          <button disabled title="Contact enrichment disabled" className="size-7 grid place-items-center rounded-md text-muted-foreground/40 cursor-not-allowed"><Zap className="size-4" /></button>
          <button onClick={addToList} title="Add to list" className="size-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><ListPlus className="size-4" /></button>
        </div>
      </td>
    </tr>
  );
}
