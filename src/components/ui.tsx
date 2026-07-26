import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-emerald-900/10 bg-white/80 shadow-sm backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-emerald-900/10 px-5 py-4">
      {icon ? (
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          {icon}
        </div>
      ) : null}
      <div>
        <h2 className="text-base font-semibold text-emerald-950">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-emerald-900/60">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-stone-100 text-stone-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = "green",
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "green" | "amber" | "blue";
}) {
  const tones: Record<string, string> = {
    green: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
  };
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/70 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-emerald-900/50">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular ${tones[tone]}`}>
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-medium text-emerald-900/50">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// A horizontal bar for the KYN aggregate view (no chart lib).
export function Bar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-emerald-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      {label ? (
        <span className="w-20 shrink-0 text-right text-xs tabular text-emerald-900/60">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : "border border-emerald-900/15 bg-white/70 text-emerald-900 hover:bg-emerald-50";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${styles}`}
    >
      {children}
    </Link>
  );
}
