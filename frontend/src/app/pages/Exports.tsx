import React from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useStore } from "../store";
import { Card, PageHeader, Badge, EmptyState } from "../ui";

export function Exports() {
  const s = useStore();
  return (
    <div>
      <PageHeader title="Exports" subtitle="History of every list you've exported" />
      <Card className="overflow-hidden">
        {s.exports.length === 0 ? (
          <EmptyState icon={Download} title="No exports yet" body="Export a list of companies or contacts and it will appear here." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left text-xs font-medium text-muted-foreground">
                {["Export Name", "Companies", "Contacts", "Date", "Format", ""].map((c) => <th key={c} className="px-3 first:pl-5 py-2.5 whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {s.exports.map((e) => (
                <tr key={e.id} className="hover:bg-muted/40">
                  <td className="pl-5 pr-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="size-8 rounded-lg bg-secondary grid place-items-center text-primary">
                        {e.format === "XLSX" ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
                      </span>
                      <span className="font-medium text-foreground">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{e.companies}</td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{e.contacts}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-3 py-3"><Badge tone={e.format === "XLSX" ? "green" : "blue"}>{e.format}</Badge></td>
                  <td className="px-3 py-3 text-right pr-5">
                    <button className="text-primary hover:underline text-[13px] font-medium inline-flex items-center gap-1"><Download className="size-3.5" />Re-download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
