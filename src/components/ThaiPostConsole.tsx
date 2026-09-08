"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Printer, Loader2, CheckCircle2, PackageSearch, Scissors, MapPin, Package, Cloud, Calendar, Flower2, User } from "lucide-react";
import Modal from "@/components/Modal";
import { thaiDateShort } from "@/lib/format";
import type { Supplier, Batch, PrintLog } from "@/lib/types";

export default function ThaiPostConsole({
  suppliers,
  batches,
  prints,
}: {
  suppliers: Supplier[];
  batches: Batch[];
  prints: PrintLog[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Batch[] | null>(null); // null = not searched
  const [notFound, setNotFound] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const supById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const roundsBySup = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of batches) m.set(b.supplierId, (m.get(b.supplierId) ?? 0) + 1);
    return m;
  }, [batches]);

  const activePrinted = useMemo(() => new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId)), [prints]);
  const printable = useMemo(
    () => batches.filter((b) => b.status === "computed" && !activePrinted.has(b.id)),
    [batches, activePrinted],
  );

  function runSearch() {
    const q = query.trim().toLowerCase();
    if (!q) { setResults(null); setNotFound(false); return; }
    const hits = printable.filter((b) => {
      const s = supById.get(b.supplierId);
      return b.supplierId.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || (s?.farmName.toLowerCase().includes(q) ?? false);
    });
    setResults(hits);
    setNotFound(hits.length === 0);
  }

  async function confirmPrint() {
    if (!results || results.length === 0) return;
    setBusy(true);
    window.print();
    for (const b of results) {
      const s = supById.get(b.supplierId);
      await fetch("/api/prints", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: b.supplierId, batchId: b.id, destination: b.destination, sortingPoint: s?.province, printedBy: "Logistic" }),
      });
    }
    setBusy(false);
    setConfirmOpen(false);
    setToast(true);
    setResults(null); setQuery("");
    setTimeout(() => setToast(false), 2600);
    router.refresh();
  }

  const qrSrc = (b: Batch) => `/api/qr?data=${encodeURIComponent(`${origin}/trace/${b.id}`)}`;

  return (
    <>
      {toast ? (
        <div className="no-print fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
          <div><p className="text-[13px] font-semibold text-slate-800">พิมพ์ QR Code สำเร็จ</p><p className="text-[12px] text-slate-400">รายการพิมพ์ถูกบันทึกเรียบร้อยแล้ว</p></div>
        </div>
      ) : null}

      <div className="no-print space-y-6">
        {/* Hero banner + search */}
        <div className="relative overflow-hidden rounded-2xl bg-[#e9f2fb]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/figma/search-banner.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right-bottom" />
          <div className="relative max-w-xl p-8">
            <h1 className="text-2xl font-bold leading-snug">
              <span className="text-blue-700">ค้นหาด้วยชื่อ หรือ SUP ID</span><br />
              <span className="text-emerald-600">เพื่อจัดการพัสดุ</span>
            </h1>
            <div className="mt-5 flex gap-3">
              <div className="flex-1">
                <div className={`flex items-center rounded-[10px] border bg-white px-4 ${notFound ? "border-[#ee443f]" : "border-gray-200"}`}>
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setNotFound(false); }}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    placeholder="SUP - 2026 - 0004  หรือ ฟาร์มเบญจมาศแม่ริม"
                    className="w-full bg-transparent py-3 text-[13px] outline-none"
                  />
                </div>
                {notFound ? <p className="mt-1.5 text-[12px] text-[#ee443f]">กรุณาตรวจสอบความถูกต้องของหมายเลขสั่งของ</p> : null}
              </div>
              <button onClick={runSearch} className="h-[46px] shrink-0 rounded-[10px] bg-blue-600 px-8 text-sm font-semibold text-white hover:bg-blue-700">ค้นหา</button>
            </div>
          </div>
        </div>

        {/* Body */}
        {results && results.length > 0 ? (
          <div className="space-y-5">
            {results.map((b) => {
              const s = supById.get(b.supplierId);
              const eta = new Date(new Date(b.entryDate + "T00:00:00").getTime() + 5 * 86400000).toISOString().slice(0, 10);
              return (
                <div key={b.id} className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.5fr_1fr]">
                  {/* Left — batch detail */}
                  <div className="lg:border-r lg:border-slate-100 lg:pr-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-full bg-blue-50 text-blue-500"><User size={20} /></span>
                        <div>
                          <div className="font-semibold text-slate-900">{s?.farmName ?? "—"}</div>
                          <div className="font-mono text-xs text-slate-400">{b.supplierId}</div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600"><Scissors size={13} /> {roundsBySup.get(b.supplierId) ?? 1} รอบการตัด</span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                      <div><div className="text-slate-400">เลข Batch (Batch No.)</div><div className="font-medium text-slate-800">{b.id}</div></div>
                      <div><div className="text-slate-400">วันที่คาดว่าจะถึง</div><div className="font-medium text-slate-800">{thaiDateShort(eta)}</div></div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 p-4 text-sm">
                      <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 text-blue-500" /><div><div className="text-slate-400">ต้นทาง</div><div className="text-slate-700">{s?.farmName}</div><div className="text-xs text-slate-400">{s?.address}</div></div></div>
                      <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 text-emerald-500" /><div><div className="text-slate-400">ปลายทาง</div><div className="text-slate-700">{b.destination ?? "—"}</div></div></div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { icon: <Flower2 size={16} />, label: "ประเภทดอก", val: b.variety || s?.flowerType || "—" },
                        { icon: <Package size={16} />, label: "จำนวนดอก", val: `${b.flowerCount.toLocaleString()} ดอก` },
                        { icon: <Cloud size={16} />, label: "Co2e/ดอก", val: `${b.co2ePerFlower.toFixed(4)} Kg` },
                        { icon: <Calendar size={16} />, label: "ตัดเมื่อ", val: thaiDateShort(b.cutDate) },
                      ].map((x, i) => (
                        <div key={i} className="rounded-lg bg-slate-50 p-2.5">
                          <div className="mx-auto mb-1 grid size-7 place-items-center rounded-md bg-white text-blue-500">{x.icon}</div>
                          <div className="text-slate-400">{x.label}</div>
                          <div className="mt-0.5 font-medium text-slate-700">{x.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right — QR */}
                  <div>
                    <div className="flex justify-between text-sm">
                      <div><div className="text-slate-400">SUP ID</div><div className="font-medium text-slate-800">{b.supplierId}</div></div>
                      <div><div className="text-slate-400">Batch ID</div><div className="font-medium text-slate-800">{b.id}</div></div>
                    </div>
                    <div className="mt-3 grid place-items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrSrc(b)} alt={`QR ${b.id}`} className="size-44" />
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">รายละเอียดเพิ่มเติม</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Co2e/ดอก</span><span className="font-medium text-slate-800">{b.co2ePerFlower.toFixed(4)} Kg</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">อายุดอกไม้</span><span className="font-medium text-slate-800">{b.ageDays} วันหลังตัด</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">ตัดเมื่อ</span><span className="font-medium text-slate-800">{thaiDateShort(b.cutDate)}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end gap-3">
              <button className="h-[42px] rounded-[8px] border border-blue-600 px-8 text-sm font-medium text-blue-600 hover:bg-blue-50">แก้ไขข้อมูล</button>
              <button onClick={() => setConfirmOpen(true)} className="inline-flex h-[42px] items-center gap-2 rounded-[8px] bg-blue-600 px-8 text-sm font-semibold text-white hover:bg-blue-700"><Printer size={16} /> พิมพ์ฉลาก</button>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center py-20 text-center">
            <div className="mb-5 grid size-28 place-items-center rounded-full bg-blue-50/70 text-blue-300"><PackageSearch size={52} /></div>
            <h2 className="text-lg font-semibold text-slate-800">ยังไม่มีรายการพัสดุ</h2>
            <p className="mt-1.5 max-w-sm text-sm text-slate-400">เมื่อมีรายการพัสดุรับเข้าจากผู้ผลิต ข้อมูลจะแสดงในหน้านี้</p>
          </div>
        )}
      </div>

      {/* Print confirm */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="ยืนยันการพิมพ์ฉลาก?">
        <p className="text-[13px] text-slate-500">หากข้อมูลไม่ถูกต้อง สามารถยกเลิกได้ที่เมนู “สถานะพัสดุ”</p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setConfirmOpen(false)} disabled={busy} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
          <button onClick={confirmPrint} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-blue-600 px-6 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={15} />} ยืนยันและพิมพ์
          </button>
        </div>
      </Modal>

      {/* Print-only labels */}
      <div className="print-only space-y-8 p-6">
        {(results ?? []).map((b) => {
          const s = supById.get(b.supplierId);
          return (
            <div key={b.id} className="text-center">
              <div className="text-lg font-bold">{s?.farmName}</div>
              <div className="text-sm">{b.supplierId} · {b.id} → {b.destination}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc(b)} alt="" className="mx-auto mt-2 size-48" />
            </div>
          );
        })}
      </div>
    </>
  );
}
