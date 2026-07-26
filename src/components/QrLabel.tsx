import { Leaf, Clock, MapPin } from "lucide-react";
import type { Supplier, Batch } from "@/lib/types";

// A print-ready shipping label: QR (→ trace page) + carbon summary.
export default function QrLabel({
  supplier,
  batch,
  traceUrl,
}: {
  supplier: Supplier;
  batch: Batch;
  traceUrl: string;
}) {
  return (
    <div className="print-label mx-auto w-[340px] rounded-2xl border border-emerald-900/15 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-emerald-950">
          KLORA<span className="text-emerald-500">·SYS</span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-emerald-900/40">
            Batch
          </div>
          <div className="font-mono text-xs font-semibold text-emerald-700">
            {batch.id}
          </div>
        </div>
      </div>

      <div className="my-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/qr?data=${encodeURIComponent(traceUrl)}`}
          alt={`QR ${batch.id}`}
          width={180}
          height={180}
          className="rounded-lg"
        />
      </div>

      <div className="text-center">
        <div className="font-semibold text-emerald-950">{supplier.farmName}</div>
        <div className="flex items-center justify-center gap-1 text-xs text-emerald-900/50">
          <MapPin size={11} /> {supplier.flowerType} · {supplier.id}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-900/10 pt-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Leaf size={14} className="text-emerald-600" />
          <span className="tabular font-semibold text-emerald-700">
            {batch.co2ePerFlower.toFixed(4)}
          </span>
          <span className="text-xs text-emerald-900/50">kg CO₂e/ดอก</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <Clock size={14} className="text-emerald-600" />
          <span className="tabular font-semibold text-emerald-950">
            {batch.ageDays} วัน
          </span>
          <span className="text-xs text-emerald-900/50">หลังตัด</span>
        </div>
      </div>
      <div className="mt-1 text-center text-[10px] text-emerald-900/40">
        ตัดเมื่อ {batch.cutDate} · {batch.flowerCount.toLocaleString()} ดอก · สแกนดูที่มา
      </div>
    </div>
  );
}
