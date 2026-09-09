"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import {
  computeCarbon, basketCarbonForRound, basketReuseCounts, sourceBreakdown,
} from "@/lib/carbon";
import { thaiDateShort } from "@/lib/format";
import type { Supplier, Batch, PrintLog } from "@/lib/types";

// สถานะข้อมูลที่รับเข้า (Figma #93 badges): คำนวณแล้ว / รอคำนวณ / ข้อมูลไม่ครบ.
function statusMeta(b: Batch, s?: Supplier): { key: string; label: string; tone: Tone } {
  if (b.status === "computed") return { key: "computed", label: "คำนวณแล้ว", tone: "blue" };
  const hasResource = !!s && !!(s.fuelLitres || s.electricityKwh || s.fertilizerKg || s.agriChemicalsKg || s.waterM3 || s.wasteKg);
  if (!hasResource) return { key: "incomplete", label: "ข้อมูลไม่ครบ", tone: "violet" };
  return { key: "pending", label: "รอคำนวณ", tone: "amber" };
}

const th = "px-4 py-3 text-left font-semibold";

export default function IncomingConsole({
  suppliers, batches, prints = [],
}: {
  suppliers: Supplier[]; batches: Batch[]; prints?: PrintLog[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [periodF, setPeriodF] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const reuseBySup = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const s of suppliers) m.set(s.id, basketReuseCounts(batches.filter((b) => b.supplierId === s.id)));
    return m;
  }, [suppliers, batches]);

  const rows = useMemo(() => {
    const now = Date.now();
    const days = periodF === "7" ? 7 : periodF === "30" ? 30 : 0;
    return [...batches]
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
      .map((b) => ({ b, s: supById.get(b.supplierId), st: statusMeta(b, supById.get(b.supplierId)) }))
      .filter(({ b, s, st }) =>
        (statusF === "all" || st.key === statusF) &&
        (days === 0 || now - new Date(b.entryDate).getTime() <= days * 86400000) &&
        (!q || b.supplierId.toLowerCase().includes(q.toLowerCase()) || (s?.farmName ?? "").includes(q)),
      );
  }, [batches, supById, q, statusF, periodF]);

  const open = openId ? batches.find((b) => b.id === openId) : null;
  const openSup = open ? supById.get(open.supplierId) : undefined;

  const detail = useMemo(() => {
    if (!open || !openSup) return null;
    const reuse = reuseBySup.get(openSup.id) ?? new Map();
    const basketRound = basketCarbonForRound(open.basketIds ?? [], (id) => reuse.get(id) ?? 0);
    const perFlower = open.status === "computed"
      ? open.co2ePerFlower
      : computeCarbon(openSup, open.flowerCount, open.distanceKm, basketRound).co2ePerFlower;
    const total = perFlower * open.flowerCount;
    const bd = sourceBreakdown([open], (id) => supById.get(id), (id) => reuse.get(id) ?? 0);
    const print = prints.find((p) => p.batchId === open.id && !p.cancelled);
    return { perFlower, total, bd, print };
  }, [open, openSup, reuseBySup, supById, prints]);

  async function compute(id: string) {
    setBusy(true);
    await fetch(`/api/batches/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "compute" }),
    });
    setBusy(false);
    setOpenId(null);
    router.refresh();
  }

  const sel = "rounded-[8px] border border-gray-300 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none focus:border-brand-purple";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">ค้นหา SUP ID หรือชื่อแหล่งผลิต</label>
          <div className="flex items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="กรอก SUP ID ที่ต้องการค้นหา" className="w-full bg-transparent py-2.5 text-[13px] outline-none" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">สถานะ</label>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={`${sel} w-full`}>
            <option value="all">ทุกสถานะ</option>
            <option value="pending">รอคำนวณ</option>
            <option value="computed">คำนวณแล้ว</option>
            <option value="incomplete">ข้อมูลไม่ครบ</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">ช่วงเวลา</label>
          <select value={periodF} onChange={(e) => setPeriodF(e.target.value)} className={`${sel} w-full`}>
            <option value="all">ทุกช่วงเวลา</option>
            <option value="7">ช่วงเวลา 7 วัน</option>
            <option value="30">ช่วงเวลา 30 วัน</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-brand-purple-head text-white">
              <th className={th}>วันที่รับข้อมูล</th>
              <th className={th}>SUP ID</th>
              <th className={th}>แหล่งผลิต</th>
              <th className={th}>วันที่ตัดดอก</th>
              <th className="px-4 py-3 text-right font-semibold">จำนวนดอก</th>
              <th className="px-4 py-3 text-center font-semibold">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">ไม่พบข้อมูลรับเข้า</td></tr>
            ) : rows.map(({ b, s, st }) => (
              <tr key={b.id} onClick={() => setOpenId(b.id)} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{thaiDateShort(b.entryDate)}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.supplierId}</td>
                <td className="px-4 py-3 text-slate-700">{s?.farmName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{thaiDateShort(b.cutDate)}</td>
                <td className="px-4 py-3 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-center"><Badge tone={st.tone}>{st.label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Result {rows.length} รายการ</span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>1 - {Math.min(50, rows.length)} of {rows.length}</span>
          <div className="flex gap-1">
            <button className="grid size-7 place-items-center rounded-md bg-brand-purple text-white"><ChevronLeft size={14} /></button>
            <button className="grid size-7 place-items-center rounded-md bg-brand-purple text-white"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Slide-over drawer */}
      {open && openSup && detail ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpenId(null)} />
          <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[440px] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-slate-500">SUP ID</span><span className="font-mono text-[15px] font-bold text-slate-900">{open.supplierId}</span></div>
                <div className="mt-1 flex items-center gap-2 text-[13px]"><span className="text-slate-400">แหล่งผลิต</span><span className="text-slate-700">{openSup.farmName}</span></div>
              </div>
              <button onClick={() => setOpenId(null)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {/* สถานะข้อมูล */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">สถานะข้อมูล</div>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    {detail.bd.total > 0 && open.status !== "submitted"
                      ? "คำนวณคาร์บอนเรียบร้อยแล้ว"
                      : statusMeta(open, openSup).key === "incomplete"
                        ? "ยังไม่มีการบันทึกข้อมูลการใช้ทรัพยากร"
                        : "พร้อมคำนวณคาร์บอน"}
                  </p>
                </div>
                <Badge tone={statusMeta(open, openSup).tone}>{statusMeta(open, openSup).label}</Badge>
              </div>

              {/* ข้อมูลเพิ่มเติม */}
              <div>
                <div className="mb-2 text-[13px] font-semibold text-slate-800">ข้อมูลเพิ่มเติม</div>
                <dl className="divide-y divide-slate-50 text-[13px]">
                  {[
                    ["ชนิดดอกไม้", openSup.flowerType || "—"],
                    ["พันธุ์ดอกไม้", open.variety || "—"],
                    ["วันที่ตัดดอก", thaiDateShort(open.cutDate)],
                    ["อายุหลังตัด", `${open.ageDays} วัน`],
                    ["จำนวนดอก", `${open.flowerCount.toLocaleString()} ดอก`],
                    ["ปลายทาง", open.destination || "—"],
                    ["Batch ID", open.id],
                    ["QR Code", detail.print ? detail.print.id : "ยังไม่พิมพ์"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-2">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="text-right font-medium text-slate-700">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* ผลการคำนวณ CO2e */}
              <div>
                <div className="mb-2 text-[13px] font-semibold text-slate-800">ผลการคำนวณ CO₂e</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-brand-purple/30 bg-brand-purple-light/50 p-4">
                    <div className="text-[12px] text-slate-500">CO₂e รวม</div>
                    <div className="mt-1 text-2xl font-bold tabular text-slate-900">{detail.total.toFixed(2)}</div>
                    <div className="text-[11px] text-slate-400">kgCO₂e</div>
                  </div>
                  <div className="rounded-xl border border-brand-blue/30 bg-brand-blue-light/60 p-4">
                    <div className="text-[12px] text-slate-500">CO₂e ต่อดอก</div>
                    <div className="mt-1 text-2xl font-bold tabular text-slate-900">{detail.perFlower.toFixed(3)}</div>
                    <div className="text-[11px] text-slate-400">kgCO₂e/ดอก</div>
                  </div>
                </div>
              </div>

              {/* กิจกรรมที่นำมาคำนวณ */}
              <div>
                <div className="mb-3 text-[13px] font-semibold text-slate-800">กิจกรรมที่นำมาคำนวณ</div>
                <div className="space-y-3">
                  {[
                    { label: "การผลิต", pct: detail.bd.pct.planting, color: "bg-brand-purple" },
                    { label: "การขนส่ง", pct: detail.bd.pct.transport, color: "bg-brand-blue" },
                    { label: "บรรจุภัณฑ์", pct: detail.bd.pct.basket, color: "bg-emerald-500" },
                  ].map((a) => (
                    <div key={a.label}>
                      <div className="flex items-center justify-between text-[13px]"><span className="font-medium text-slate-700">{a.label}</span><span className="tabular text-slate-500">{a.pct}%</span></div>
                      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${a.color}`} style={{ width: `${Math.max(a.pct, 2)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              {open.status === "submitted" ? (
                <button onClick={() => compute(open.id)} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-brand-purple px-5 py-3 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยันและคำนวณ CO₂e
                </button>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
