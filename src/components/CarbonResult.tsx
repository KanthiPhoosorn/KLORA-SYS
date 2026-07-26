import { Leaf, Clock } from "lucide-react";
import type { Batch } from "@/lib/types";

// Freshness tone from age (days after cut).
function ageTone(days: number): { tone: string; label: string } {
  if (days <= 2) return { tone: "bg-emerald-100 text-emerald-800", label: "สดมาก" };
  if (days <= 5) return { tone: "bg-amber-100 text-amber-800", label: "ปานกลาง" };
  return { tone: "bg-red-100 text-red-700", label: "ควรเร่งจำหน่าย" };
}

export default function CarbonResult({ batch }: { batch: Batch }) {
  const age = ageTone(batch.ageDays);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/60 px-3 py-2">
        <div className="flex items-center gap-1 text-xs font-medium text-emerald-900/60">
          <Leaf size={12} /> CO₂e / ดอก
        </div>
        <div className="mt-0.5 text-lg font-bold tabular text-emerald-700">
          {batch.co2ePerFlower.toFixed(4)}
          <span className="ml-1 text-xs font-medium text-emerald-900/50">
            kg
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-emerald-900/10 bg-white px-3 py-2">
        <div className="flex items-center gap-1 text-xs font-medium text-emerald-900/60">
          <Clock size={12} /> อายุหลังตัด
        </div>
        <div className="mt-0.5 text-lg font-bold tabular text-emerald-950">
          {batch.ageDays}
          <span className="ml-1 text-xs font-medium text-emerald-900/50">
            วัน
          </span>
        </div>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${age.tone}`}
        >
          {age.label}
        </span>
      </div>
      <div className="rounded-xl border border-emerald-900/10 bg-white px-3 py-2">
        <div className="text-xs font-medium text-emerald-900/60">จำนวนดอก</div>
        <div className="mt-0.5 text-lg font-bold tabular text-emerald-950">
          {batch.flowerCount.toLocaleString()}
        </div>
      </div>
      <div className="rounded-xl border border-emerald-900/10 bg-white px-3 py-2">
        <div className="text-xs font-medium text-emerald-900/60">ระยะทาง</div>
        <div className="mt-0.5 text-lg font-bold tabular text-emerald-950">
          {batch.distanceKm.toLocaleString()}
          <span className="ml-1 text-xs font-medium text-emerald-900/50">
            km
          </span>
        </div>
      </div>
    </div>
  );
}
