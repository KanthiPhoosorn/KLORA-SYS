import { AlertTriangle } from "lucide-react";
import type { RecipientDistance } from "@/lib/use-distance";

// The line under "ระยะทางขนส่ง" in both round forms: how the distance was worked out — or what is
// missing — and, when the recipient address could only be placed at province level, a warning that
// asks for the recipient's pin (13 Oct 2026: distance must come from the address, not the province).
export default function DistanceHint({ edited, onAuto, dist, noOrigin = "เลือกสาขาต้นทางเพื่อคำนวณระยะทาง" }: {
  edited: boolean; onAuto: () => void; dist: RecipientDistance;
  /** what to say when there is no origin point to measure from */
  noOrigin?: string;
}) {
  const { looking, basis, approx, needAddress, notFound } = dist;
  const warn = (text: string) => (
    <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-amber-700">
      <AlertTriangle size={12} className="mt-px shrink-0" /> {text}
    </p>
  );
  if (edited) return <p className="mt-1 text-[11px] text-slate-400">แก้ไขเอง · <button type="button" onClick={onAuto} className="underline">ให้ระบบคำนวณ</button></p>;
  if (needAddress) return <p className="mt-1 text-[11px] text-slate-400">กรอกที่อยู่ผู้รับ ระบบจะคำนวณระยะทางจากสาขาต้นทางให้</p>;
  if (looking) return <p className="mt-1 text-[11px] text-slate-400">กำลังหาตำแหน่งที่อยู่ผู้รับ…</p>;
  if (approx) return warn("หาที่อยู่ผู้รับไม่พบ — ระยะทางนี้ประมาณจากจังหวัดปลายทาง ใส่ ตำบล/อำเภอ ให้ครบ หรือใส่พิกัดผู้รับเพื่อให้แม่นยำ");
  if (notFound) return warn("หาที่อยู่ผู้รับไม่พบ — ใส่ ตำบล/อำเภอ/จังหวัด ให้ครบ ใส่พิกัดผู้รับ หรือกรอกระยะทางเอง");
  return <p className="mt-1 text-[11px] text-slate-400">{basis || noOrigin}</p>;
}
