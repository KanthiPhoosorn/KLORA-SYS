import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import { Badge, Card, type Tone } from "@/components/ui";
import { thaiDateTime } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface LogRow {
  at: string;
  actor: string;
  actorSub: string;
  type: string;
  detail: string;
  status: string;
  tone: Tone;
}

// Action Log (Figma "Log การจัดการซับ") — a real, timestamped activity feed derived from
// system events (supplier onboarding, export rounds, QR printing) rather than mock data.
export default async function KynActionLogPage() {
  await requireRole("kyn");
  const [suppliers, batches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  const supName = (id: string) => suppliers.find((s) => s.id === id)?.farmName ?? id;

  const rows: LogRow[] = [];

  for (const s of suppliers) {
    rows.push({
      at: s.createdAt,
      actor: s.farmName,
      actorSub: s.id,
      type: "ลงทะเบียนผู้ผลิต",
      detail: `${s.province ?? "—"} · ${s.flowerType}`,
      status: s.status === "suspended" ? "ระงับการใช้งาน" : "ใช้งาน",
      tone: s.status === "suspended" ? "red" : "green",
    });
  }
  for (const b of batches) {
    rows.push({
      at: b.createdAt,
      actor: supName(b.supplierId),
      actorSub: b.supplierId,
      type: b.status === "computed" ? "คำนวณคาร์บอนแล้ว" : "ส่งข้อมูลรอบส่งออก",
      detail: `${b.id} · ${b.flowerCount.toLocaleString()} ดอก → ${b.destination ?? "—"}`,
      status: b.status === "computed" ? "คำนวณแล้ว" : "รอคำนวณ",
      tone: b.status === "computed" ? "green" : "amber",
    });
  }
  for (const p of prints) {
    rows.push({
      at: p.printedAt,
      actor: p.printedBy || "ไปรษณีย์ไทย",
      actorSub: p.sortingPoint ?? "จุดคัดแยก",
      type: p.cancelled ? "ยกเลิกการพิมพ์ QR" : "พิมพ์ QR Code",
      detail: `${p.batchId ?? p.supplierId} → ${p.destination ?? "—"}`,
      status: p.cancelled ? "ยกเลิกแล้ว" : "สำเร็จ",
      tone: p.cancelled ? "red" : "green",
    });
  }

  rows.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Action Log</h1>
        <p className="mt-0.5 text-[13px] text-slate-400">บันทึกกิจกรรมและการเปลี่ยนแปลงทั้งหมดในระบบ</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-slate-500">Result {rows.length} รายการ</span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>1 - {Math.min(50, rows.length)} of {rows.length}</span>
          <div className="flex gap-1">
            <button className="grid size-7 place-items-center rounded-md bg-indigo-600 text-white"><ChevronLeft size={14} /></button>
            <button className="grid size-7 place-items-center rounded-md bg-indigo-600 text-white"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-indigo-600 text-left font-semibold text-white">
              <th className="px-5 py-3">เวลาที่ทำ</th>
              <th className="px-5 py-3">ผู้ทำ</th>
              <th className="px-5 py-3">ประเภท</th>
              <th className="px-5 py-3">รายละเอียด</th>
              <th className="px-5 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">ยังไม่มีกิจกรรม</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 whitespace-nowrap text-slate-600">{thaiDateTime(r.at)}</td>
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800">{r.actor}</div>
                  <div className="font-mono text-xs text-slate-400">{r.actorSub}</div>
                </td>
                <td className="px-5 py-3 text-slate-700">{r.type}</td>
                <td className="px-5 py-3 text-slate-600">{r.detail}</td>
                <td className="px-5 py-3"><Badge tone={r.tone}>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
