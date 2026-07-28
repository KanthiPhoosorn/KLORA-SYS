import Link from "next/link";
import type { ReactNode } from "react";

// --- Card ------------------------------------------------------------------

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
      {icon ? (
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}

// --- Badge -----------------------------------------------------------------

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "orange";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

// --- StatCard --------------------------------------------------------------

const STAT_ACCENT: Record<string, string> = {
  slate: "text-slate-900",
  blue: "text-blue-600",
  orange: "text-orange-600",
  green: "text-emerald-600",
};

export function StatCard({
  label,
  value,
  unit,
  accent = "slate",
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  accent?: keyof typeof STAT_ACCENT;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular ${STAT_ACCENT[accent]}`}>
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

// --- Bar (horizontal progress) --------------------------------------------

export function Bar({
  value,
  max,
  className = "bg-blue-500",
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// --- BarChart (vertical columns, e.g. monthly trend) ----------------------

export function BarChart({
  data,
  height = 140,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-blue-500/90"
              style={{ height: `${(d.value / max) * 100}%` }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-xs text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// --- Buttons ---------------------------------------------------------------

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}
