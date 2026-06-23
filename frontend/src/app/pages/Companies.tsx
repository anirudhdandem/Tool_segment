import React, { useEffect, useMemo, useState } from "react";
import { Building2, Download, ListPlus, Star, LayoutGrid, List as ListIcon, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useStore, clean, SEGMENTS, type Company } from "../store";
import { Card, PageHeader, Button, SearchInput, Select, Badge, Score, StatusPill, Avatar, Tabs, cn } from "../ui";
import { downloadCompaniesCsv, hostOf } from "../util";

export function Companies() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("score");
  const [view, setView] = useState("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const PER_PAGE = 24;

  const rows = useMemo(() => {
    let r = s.companies.filter((c) =>
      (cat === "All" || c.category === cat) &&
      (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.city.toLowerCase().includes(q.toLowerCase())));
    r = [...r].sort((a, b) => sort === "score" ? b.score - a.score : sort === "name" ? a.name.localeCompare(b.name) : (parseFloat(b.rating || "0") - parseFloat(a.rating || "0")));
    return r;
  }, [s.companies, q, cat, sort]);

  // Pagination — reset to page 1 whenever the filtered set changes.
  useEffect(() => { setPage(1); }, [q, cat, sort, s.companies.length]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const rangeStart = rows.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * PER_PAGE, rows.length);

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exportSel = () => {
    const list = selected.size ? rows.filter((c) => selected.has(c.id)) : rows;
    downloadCompaniesCsv("companies_export", list);
    s.recordExport("Companies export", list.map((c) => c.id), "CSV");
  };

  return (
    <div>
      <PageHeader title="Companies" subtitle={`${s.companies.length} companies in your workspace`}
        actions={<><Button onClick={exportSel}><Download className="size-4" />Export</Button><Button variant="primary" onClick={() => s.setPage("discovery")}><Building2 className="size-4" />Discover more</Button></>} />

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="w-64"><SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" /></div>
          <div className="w-48"><Select value={cat} onChange={(e) => setCat(e.target.value)}><option>All</option>{SEGMENTS.map((x) => <option key={x}>{x}</option>)}</Select></div>
          <div className="w-40"><Select value={sort} onChange={(e) => setSort(e.target.value)}><option value="score">Sort: Lead score</option><option value="name">Sort: Name</option><option value="rating">Sort: Rating</option></Select></div>
          <div className="ml-auto"><Tabs value={view} onChange={setView} tabs={[{ id: "table", label: "Table" }, { id: "cards", label: "Cards" }]} /></div>
        </div>

        {selected.size > 0 && (
          <div className="px-5 py-2.5 bg-secondary/60 border-b border-border flex items-center gap-3">
            <span className="text-[13px] font-medium text-primary">{selected.size} selected</span>
            <Button size="sm" onClick={() => s.addToList(s.lists[0]?.id, [...selected])}><ListPlus className="size-4" />Add to {s.lists[0]?.name}</Button>
            <Button size="sm" onClick={exportSel}><Download className="size-4" />Export selected</Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        {view === "table" ? (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="pl-5 pr-2 py-2.5 w-9" />
                  {["Company", "Category", "Location", "Company Size", "Funding", "Lead Score", "Status", ""].map((c) => <th key={c} className="px-3 py-2.5 whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map((c) => {
                  const host = hostOf(c.website);
                  return (
                    <tr key={c.id} className={cn("hover:bg-muted/40", selected.has(c.id) && "bg-secondary/40")}>
                      <td className="pl-5 pr-2 py-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-[var(--primary)]" /></td>
                      <td className="px-3 py-3">
                        <button onClick={() => s.openCompany(c.id)} className="flex items-center gap-2.5 group text-left">
                          <Avatar name={c.name} size={30} />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground group-hover:text-primary truncate max-w-[200px]">{c.name}</div>
                            {host && <div className="text-xs text-muted-foreground inline-flex items-center gap-1">{host}</div>}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3"><Badge tone="indigo">{c.category}</Badge></td>
                      <td className="px-3 py-3 text-muted-foreground">{c.city || "—"}</td>
                      <td className="px-3 py-3 max-w-[160px]"><div className="truncate" title={clean(c.companySize)}>{clean(c.companySize) || <span className="text-muted-foreground/60">—</span>}</div></td>
                      <td className="px-3 py-3 max-w-[170px]"><div className="truncate" title={clean(c.funding)}>{clean(c.funding) || <span className="text-muted-foreground/60">—</span>}</div></td>
                      <td className="px-3 py-3"><Score value={c.score} /></td>
                      <td className="px-3 py-3"><StatusPill status={c.status} /></td>
                      <td className="px-3 py-3"><Button size="sm" variant="ghost" onClick={() => s.openCompany(c.id)}>View</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {paged.map((c) => (
              <button key={c.id} onClick={() => s.openCompany(c.id)} className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={c.name} size={40} />
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.city}</div>
                    </div>
                  </div>
                  {clean(c.rating) && <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Star className="size-3 fill-amber-400 text-amber-400" />{c.rating}</span>}
                </div>
                <div className="mt-3"><Badge tone="indigo">{c.category}</Badge></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Size</div><div className="text-foreground font-medium truncate">{clean(c.companySize) || "—"}</div></div>
                  <div><div className="text-muted-foreground">Funding</div><div className="text-foreground font-medium truncate">{clean(c.funding) || "—"}</div></div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <Score value={c.score} /><StatusPill status={c.status} />
                </div>
              </button>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground tabular-nums">
              Showing {rangeStart}–{rangeEnd} of {rows.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="size-4" />Prev</Button>
              <span className="px-2 text-xs text-muted-foreground tabular-nums">Page {safePage} / {pageCount}</span>
              <Button size="sm" variant="ghost" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next<ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
