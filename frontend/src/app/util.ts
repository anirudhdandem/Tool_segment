import { Company, clean } from "./store";

const COLS: [string, (c: Company) => string][] = [
  ["Company Name", (c) => c.name],
  ["Category", (c) => c.category],
  ["City", (c) => c.city || ""],
  ["Phone", (c) => clean(c.phone)],
  ["Website", (c) => clean(c.website)],
  ["Email", (c) => clean(c.email)],
  ["Contact Person", (c) => clean(c.contactName)],
  ["Designation", (c) => clean(c.designation)],
  ["Company Size", (c) => clean(c.companySize)],
  ["Funding", (c) => clean(c.funding)],
  ["Transaction Volume", (c) => clean(c.transactionVolume)],
  ["Rating", (c) => clean(c.rating)],
  ["Reviews", (c) => clean(c.reviewCount)],
  ["Lead Score", (c) => String(c.score)],
  ["Source", (c) => clean(c.source)],
];

export function downloadCompaniesCsv(filename: string, companies: Company[]) {
  const head = COLS.map(([h]) => h).join(",");
  const rows = companies.map((c) => COLS.map(([, f]) => `"${(f(c) || "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[head, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function hostOf(url?: string) {
  if (!clean(url)) return "";
  try { return new URL(url!.startsWith("http") ? url! : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}
