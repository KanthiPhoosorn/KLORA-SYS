"use client";

import { Calendar } from "lucide-react";

// ISO (yyyy-mm-dd) → Thai display "วว/ดด/ปปปป" with a Buddhist-era year (พ.ศ. = ค.ศ. + 543).
export function formatThaiDate(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
}

// A date input that DISPLAYS the Thai วว/ดด/ปปปป format (native date inputs are locked to the
// browser locale, e.g. mm/dd/yyyy). A transparent native <input type="date"> overlays the field
// so the OS calendar still opens on click; the visible field shows the Thai-formatted value.
export default function DateField({
  value,
  onChange,
  className = "",
  invalid = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        readOnly
        value={formatThaiDate(value)}
        placeholder="วว/ดด/ปปปป"
        className={`${className} pr-10 ${invalid ? "border-[#ee443f]" : ""}`}
      />
      <Calendar size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="เลือกวันที่"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
