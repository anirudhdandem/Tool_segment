/** Right-side company intelligence drawer — opens from any company row. */
import React, { useEffect } from "react";
import {
  X, MapPin, Globe, Phone, Building2, Banknote, Users, Star, Mail,
  Sparkles, ExternalLink, Bookmark, Zap, ListPlus, TrendingUp,
} from "lucide-react";
import { useStore, clean } from "./store";
import { Badge, Button, Score, StatusPill, Avatar, DataRow, cn } from "./ui";

function naField(v?: string) {
  return clean(v) ? <>{clean(v)}</> : <span className="text-muted-foreground/70 italic font-normal">Not available</span>;
}

export function CompanyDrawer() {
  const { openCompanyId, openCompany, companies, lists, addToList } = useStore();
  const company = companies.find((c) => c.id === openCompanyId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openCompany(null);
    if (openCompanyId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCompanyId, openCompany]);

  if (!openCompanyId || !company) return null;

  const related = companies.filter((c) => c.category === company.category && c.id !== company.id).slice(0, 4);
  const host = (() => { try { return new URL(company.website!.startsWith("http") ? company.website! : `https://${company.website}`).hostname.replace(/^www\./, ""); } catch { return ""; } })();

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="px-6 py-5 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-muted-foreground" />
        <h4 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      </div>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#1F2433]/40 backdrop-blur-[2px]" onClick={() => openCompany(null)} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-card shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]"
        style={{ animationName: "none" }}>
        {/* header */}
        <div className="px-6 pt-6 pb-5 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={company.name} size={44} />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground truncate">{company.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone="indigo">{company.category}</Badge>
                  <StatusPill status={company.status} />
                </div>
              </div>
            </div>
            <button onClick={() => openCompany(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button variant="primary" size="sm" disabled title="Contact enrichment disabled"><Zap className="size-4" />Enrich</Button>
            <Button size="sm"><Bookmark className="size-4" />Save</Button>
            <div className="relative group">
              <Button size="sm"><ListPlus className="size-4" />Add to list</Button>
              <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg p-1 hidden group-hover:block z-10">
                {lists.map((l) => (
                  <button key={l.id} onClick={() => addToList(l.id, [company.id])}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-foreground hover:bg-muted text-left">
                    <span className="size-2 rounded-full" style={{ background: l.color }} />{l.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Lead score</div>
              <div className="mt-1"><Score value={company.score} /></div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll">
          <Section title="Company Overview" icon={Building2}>
            <p className="text-sm text-foreground leading-relaxed">
              {clean(company.description) ||
                `${company.name} is a ${company.category.toLowerCase()} firm operating in ${company.city || "India"}. ` +
                `${clean(company.funding) ? `Funding: ${clean(company.funding)}. ` : ""}${clean(company.companySize) ? `Team: ${clean(company.companySize)}.` : ""}`}
            </p>
            <div className="mt-3 space-y-0">
              <DataRow label="Industry">{naField(company.category)}</DataRow>
              <DataRow label="Location">{clean(company.address) || company.city || <span className="text-muted-foreground/70 italic">—</span>}</DataRow>
              <DataRow label="Website">
                {host ? <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">{host}<ExternalLink className="size-3" /></a> : naField()}
              </DataRow>
              <DataRow label="Phone">{naField(company.phone)}</DataRow>
              <DataRow label="Source">{naField(company.source)}</DataRow>
            </div>
          </Section>

          <Section title="Funding Information" icon={Banknote}>
            <div className="rounded-lg bg-secondary/60 px-4 py-3">
              <div className="text-base font-semibold text-foreground">{naField(company.funding)}</div>
              {clean(company.transactionVolume) && <div className="text-sm text-muted-foreground mt-0.5">{clean(company.transactionVolume)}</div>}
            </div>
          </Section>

          <Section title="Company Size & Volume" icon={Users}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-xs text-muted-foreground">Headcount / Revenue</div>
                <div className="text-sm font-semibold text-foreground mt-1">{naField(company.companySize)}</div>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-xs text-muted-foreground">Transaction Volume</div>
                <div className="text-sm font-semibold text-foreground mt-1">{naField(company.transactionVolume)}</div>
              </div>
            </div>
          </Section>

          <Section title="Google Maps Information" icon={MapPin}>
            <div className="space-y-0">
              <DataRow label="Rating">
                {clean(company.rating) ? <span className="inline-flex items-center gap-1 text-amber-600"><Star className="size-3.5 fill-amber-400 text-amber-400" />{company.rating}</span> : naField()}
              </DataRow>
              <DataRow label="Reviews">{naField(company.reviewCount)}</DataRow>
              <DataRow label="Address">{clean(company.address) || company.city || <span className="text-muted-foreground/70 italic">—</span>}</DataRow>
            </div>
          </Section>

          <Section title={`Contacts${(company.contacts?.length ?? 0) > 0 ? ` (${company.contacts!.length})` : ""}`} icon={Mail}>
            {(company.contacts?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {company.contacts!.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-border px-4 py-3">
                    <Avatar name={clean(p.name) || company.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{clean(p.name) || "Decision maker"}</span>
                        {p.source && <Badge tone={p.source.includes("Hunter") ? "violet" : p.source.includes("Apollo") ? "indigo" : p.source.includes("Web") && !p.source.includes("Website") ? "gray" : "blue"}>{p.source}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{clean(p.designation) || "—"}</div>
                      {clean(p.email) && <a href={`mailto:${p.email}`} className="text-xs text-primary hover:underline block truncate">{p.email}</a>}
                      <div className="flex items-center gap-3 mt-0.5">
                        {clean(p.phone) && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                        {clean(p.linkedin) && <a href={`https://${p.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">LinkedIn</a>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : clean(company.contactName) || clean(company.email) ? (
              <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                <Avatar name={clean(company.contactName) || company.name} size={38} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{clean(company.contactName) || "Decision maker"}</div>
                  <div className="text-xs text-muted-foreground">{clean(company.designation) || "—"}</div>
                  {clean(company.email) && <a href={`mailto:${company.email}`} className="text-xs text-primary hover:underline">{company.email}</a>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No decision maker found yet. Run enrichment to discover contacts.</p>
            )}
          </Section>

          {related.length > 0 && (
            <Section title="Related Companies" icon={Building2}>
              <div className="space-y-1">
                {related.map((r) => (
                  <button key={r.id} onClick={() => openCompany(r.id)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted text-left">
                    <Avatar name={r.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.city}</div>
                    </div>
                    <Score value={r.score} />
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Lead Intelligence Summary" icon={Sparkles}>
            <div className="rounded-lg bg-gradient-to-br from-secondary to-secondary/40 px-4 py-3.5 border border-primary/10">
              <div className="flex items-center gap-2 text-primary mb-2">
                <TrendingUp className="size-4" />
                <span className="text-[13px] font-semibold">Why this is a {company.score >= 75 ? "strong" : company.score >= 50 ? "moderate" : "early"} lead</span>
              </div>
              <ul className="text-[13px] text-foreground/80 space-y-1 list-disc pl-4">
                {clean(company.email) && <li>Verified contact channel ({clean(company.email)})</li>}
                {clean(company.contactName) && <li>Decision maker identified: {clean(company.contactName)}</li>}
                {clean(company.funding) && <li>Funding signal: {clean(company.funding)}</li>}
                {clean(company.companySize) && <li>Operating scale: {clean(company.companySize)}</li>}
                {clean(company.rating) && <li>{company.rating}★ on Google Maps ({clean(company.reviewCount) || "—"} reviews)</li>}
                {company.score < 50 && <li className="text-muted-foreground">Limited public data — enrich to raise confidence.</li>}
              </ul>
            </div>
            {clean(company.profileSources) && (
              <p className="text-[11px] text-muted-foreground mt-2 truncate" title={company.profileSources}>
                Sources: {company.profileSources}
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
