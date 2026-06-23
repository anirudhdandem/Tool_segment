/** Shared UI primitives for the platform — premium SaaS styling on Tailwind. */
import React from "react";
import clsx from "clsx";
import { Search as SearchIcon, ChevronDown } from "lucide-react";

export const cn = (...a: any[]) => clsx(...a);

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-card border border-border rounded-xl shadow-[0_1px_2px_rgba(16,24,40,0.05)]", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex gap-3">
        <span className="mt-1 w-[3px] shrink-0 self-stretch rounded-full bg-primary" aria-hidden />
        <div>
          {eyebrow && <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{eyebrow}</div>}
          <h1 className="text-[24px] font-bold text-foreground tracking-[-0.02em] leading-none">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export function Button({
  variant = "secondary", size = "md", className, children, ...rest
}: { variant?: BtnVariant; size?: "sm" | "md" | "lg" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 whitespace-nowrap";
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm", lg: "h-11 px-7 text-[15px] gap-2" };
  const variants: Record<BtnVariant, string> = {
    primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_4px_14px_rgba(79,70,229,0.20)]",
    secondary: "bg-card text-foreground border border-border hover:bg-muted",
    outline: "bg-transparent text-foreground border border-border hover:bg-muted",
    ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-card text-red-600 border border-border hover:bg-red-50",
  };
  return <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>{children}</button>;
}

type Tone = "indigo" | "green" | "amber" | "red" | "gray" | "blue" | "violet";
// Light soft-fill tones: pale bg + saturated text + matching ring.
const toneMap: Record<Tone, string> = {
  indigo: "bg-[#EEF0FB] text-[#4338CA] ring-[#4F46E5]/15",
  green: "bg-[#ECFDF5] text-[#047857] ring-[#059669]/15",
  amber: "bg-[#FEF3C7] text-[#B45309] ring-[#D97706]/20",
  red: "bg-[#FEF2F2] text-[#DC2626] ring-[#DC2626]/15",
  gray: "bg-[#F1F3F7] text-[#5B6472] ring-[#94A3B8]/20",
  blue: "bg-[#EFF6FF] text-[#2563EB] ring-[#2563EB]/15",
  violet: "bg-[#F5F3FF] text-[#7C3AED] ring-[#8B5CF6]/15",
};
export function Badge({ tone = "gray", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset", toneMap[tone], className)}>
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: "new" | "enriching" | "enriched" }) {
  if (status === "enriched") return <Badge tone="green"><span className="size-1.5 rounded-full bg-emerald-500" />Enriched</Badge>;
  if (status === "enriching") return <Badge tone="amber"><span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />Enriching</Badge>;
  return <Badge tone="gray"><span className="size-1.5 rounded-full bg-slate-400" />New</Badge>;
}

/** Signature element: a notched level meter — quantitative values read as instrument output, not decoration. */
const meterColor = (v: number) => (v >= 75 ? "var(--score-high)" : v >= 50 ? "var(--score-mid)" : "var(--score-low)");
export function Meter({ value, max = 100, segments = 12, suffix = "" }: { value: number; max?: number; segments?: number; suffix?: string }) {
  const color = meterColor((value / max) * 100);
  const filled = Math.round((value / max) * segments);
  return (
    <div className="flex items-center gap-2 w-[92px]">
      <div className="flex items-end gap-[2px] h-3.5 flex-1" role="meter" aria-valuenow={value} aria-valuemax={max}>
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className="flex-1 rounded-[1px] transition-[height,background] duration-300"
            style={{ height: i < filled ? "100%" : "40%", background: i < filled ? color : "var(--border)" }} />
        ))}
      </div>
      <span className="font-mono text-[12px] font-medium tabular-nums w-9 text-right" style={{ color }}>{value}{suffix}</span>
    </div>
  );
}

export function Score({ value }: { value: number }) {
  return <Meter value={value} />;
}

export function Confidence({ value }: { value: number }) {
  const color = meterColor(value);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-medium tabular-nums" style={{ color }}>
      <span className="size-1.5 rounded-full" style={{ background: color }} />{value}%
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-9 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground",
        "placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition",
        props.className
      )}
    />
  );
}

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <SearchIcon className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        {...props}
        className={cn(
          "w-full h-9 pl-9 pr-3 rounded-lg bg-input-background border border-border text-sm text-foreground",
          "placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition",
          props.className
        )}
      />
    </div>
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "w-full h-9 pl-3 pr-9 rounded-lg bg-input-background border border-border text-sm text-foreground appearance-none cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition",
          props.className
        )}
      >
        {children}
      </select>
      <ChevronDown className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-foreground mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: any; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="size-12 rounded-xl bg-secondary grid place-items-center text-primary mb-4">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {body && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-40" : c === cols - 1 ? "w-16 ml-auto" : "w-24")} />
          ))}
        </div>
      ))}
    </div>
  );
}

const AVATAR_COLORS = ["#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#6396E0", "#EC4899", "#14B8A6"];
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <span className="inline-grid place-items-center rounded-full text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cn("h-7 px-3 rounded-md text-[13px] font-medium transition-colors flex items-center gap-1.5",
            value === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {t.label}
          {t.count != null && <span className={cn("text-xs", value === t.id ? "text-muted-foreground" : "text-muted-foreground/70")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Inline data row for the company drawer / detail sections. */
export function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-foreground text-right">{children}</span>
    </div>
  );
}
