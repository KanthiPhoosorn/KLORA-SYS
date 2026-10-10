"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import type { RatingSummary } from "@/lib/types";

// ★ 4.6 · 12 คะแนน — the average of this farm / this carrier on the QR page; refreshes after the visitor rates.
export default function RatingBadge({ kind, initial }: { kind: "farm" | "transport"; initial: RatingSummary }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent).detail as { farm: RatingSummary; transport: RatingSummary } | undefined; if (d) setS(d[kind]); };
    window.addEventListener("corta:rated", on);
    return () => window.removeEventListener("corta:rated", on);
  }, [kind]);
  if (!s.n) return <span className="whitespace-nowrap text-[12px] text-slate-400">ยังไม่มีคะแนน</span>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-slate-600" aria-label={`คะแนนเฉลี่ย ${s.avg.toFixed(1)} จาก 5 · ${s.n} คะแนน`}>
      <Star size={13} className="fill-[#EE2C34] text-[#EE2C34]" /><b className="text-slate-800">{s.avg.toFixed(1)}</b> · {s.n} คะแนน
    </span>
  );
}
