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

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "orange" | "violet";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
  violet: "bg-violet-100 text-violet-700",
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

// --- MetricCard (labelled value + icon + sub-note) — the portal dashboard card

const METRIC_ICON: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-500",
  pink: "bg-pink-50 text-pink-600",
  slate: "bg-slate-100 text-slate-500",
};
const METRIC_VALUE: Record<string, string> = {
  green: "text-emerald-600",
  blue: "text-blue-600",
  orange: "text-orange-500",
  pink: "text-pink-600",
  slate: "text-slate-900",
};

export function MetricCard({
  label,
  value,
  unit,
  note,
  icon,
  tone = "slate",
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof METRIC_ICON;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className={`mt-1 text-3xl font-bold tabular ${METRIC_VALUE[tone]}`}>
            {value}
            {unit ? <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span> : null}
          </div>
        </div>
        {icon ? (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${METRIC_ICON[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>
      {note ? <div className="mt-2 text-xs text-slate-400">{note}</div> : null}
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
  barClassName = "bg-blue-500/90",
}: {
  data: { label: string; value: number }[];
  height?: number;
  barClassName?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t-md ${barClassName}`}
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

// --- Donut (conic-gradient, no chart lib) ---------------------------------

export const DONUT_COLORS = ["#10b981", "#3b82f6", "#22c55e", "#5eead4", "#f59e0b", "#a78bfa"];

export function Donut({
  segments,
  centerTop,
  centerValue,
  centerUnit,
}: {
  segments: { label: string; pct: number; color: string }[];
  centerTop?: string;
  centerValue?: ReactNode;
  centerUnit?: string;
}) {
  let acc = 0;
  const stops = segments
    .map((s) => {
      const from = acc;
      acc += s.pct;
      return `${s.color} ${from}% ${acc}%`;
    })
    .join(", ");
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="relative h-44 w-44 shrink-0 rounded-full"
        style={{ background: segments.length ? `conic-gradient(${stops})` : "#e2e8f0" }}
      >
        <div className="absolute inset-[24%] grid place-items-center rounded-full bg-white text-center shadow-sm">
          <div>
            {centerTop ? <div className="text-[11px] text-slate-400">{centerTop}</div> : null}
            <div className="text-2xl font-bold text-slate-900">{centerValue}</div>
            {centerUnit ? <div className="text-[11px] text-slate-400">{centerUnit}</div> : null}
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-3 tabular font-medium text-slate-800">{s.pct}%</span>
          </li>
        ))}
      </ul>
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
