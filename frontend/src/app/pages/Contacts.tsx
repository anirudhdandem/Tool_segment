import React, { useMemo, useState } from "react";
import { Users, Mail, Phone, Linkedin, Download, Copy } from "lucide-react";
import { useStore } from "../store";
import { Card, PageHeader, Button, SearchInput, Badge, Avatar, Confidence, EmptyState, cn } from "../ui";

const ROLE_FILTERS = ["All", "CEO", "Founder", "Sales", "Partnerships", "Product", "Marketing"];

export function Contacts() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("All");

  const rows = useMemo(() => s.contacts.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.company.toLowerCase().includes(q.toLowerCase()) && !c.email.toLowerCase().includes(q.toLowerCase())) return false;
    if (role !== "All") { const t = c.title.toLowerCase(); if (role === "CEO" && !/ceo|chief exec/.test(t)) return false; if (role === "Founder" && !/founder/.test(t)) return false; if (role === "Sales" && !/sales|revenue|business/.test(t)) return false; if (role === "Partnerships" && !/partner/.test(t)) return false; if (role === "Product" && !/product/.test(t)) return false; if (role === "Marketing" && !/market|growth|brand/.test(t)) return false; }
    return true;
  }), [s.contacts, q, role]);

  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${s.contacts.length} decision makers discovered`}
        actions={<Button variant="primary"><Download className="size-4" />Export contacts</Button>} />

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="w-64"><SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" /></div>
          <div className="flex items-center gap-1 flex-wrap">
            {ROLE_FILTERS.map((r) => (
              <button key={r} onClick={() => setRole(r)}
                className={cn("h-8 px-3 rounded-lg text-[13px] font-medium border transition-colors",
                  role === r ? "bg-secondary text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:bg-muted")}>{r}</button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No contacts match" body="Try a different role filter or discover and enrich more companies." />
        ) : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  {["Name", "Title", "Company", "Email", "Phone", "LinkedIn", "Source", "Confidence"].map((c) => <th key={c} className="px-3 first:pl-5 py-2.5 whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="pl-5 pr-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} size={32} />
                        <span className="font-medium text-foreground">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{c.title}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => s.openCompany(c.companyId)} className="text-foreground hover:text-primary font-medium">{c.company}</button>
                    </td>
                    <td className="px-3 py-3">
                      {c.email ? <a href={`mailto:${c.email}`} className="text-primary hover:underline inline-flex items-center gap-1.5"><Mail className="size-3.5" />{c.email}</a> : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-3 py-3">{c.phone ? <span className="inline-flex items-center gap-1.5 text-foreground"><Phone className="size-3.5 text-muted-foreground" />{c.phone}</span> : <span className="text-muted-foreground/60">—</span>}</td>
                    <td className="px-3 py-3">{c.linkedin ? <a href={`https://${c.linkedin}`} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline inline-flex items-center gap-1"><Linkedin className="size-3.5" />Profile</a> : <span className="text-muted-foreground/60">—</span>}</td>
                    <td className="px-3 py-3"><Badge tone={c.source === "Hunter" ? "violet" : c.source === "Website" ? "blue" : "gray"}>{c.source}</Badge></td>
                    <td className="px-3 py-3"><Confidence value={c.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
