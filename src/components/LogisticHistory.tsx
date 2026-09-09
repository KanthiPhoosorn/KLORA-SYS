"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, Loader2, CheckCircle2 } from "lucide-react";
import Modal from "@/components/Modal";
import DateField from "@/components/DateField";
import { Badge, type Tone } from "@/components/ui";

export interface PrintRow {
  id: string;
  supplierId: string;
  printedAtIso: string;
  batchId: string;
  destination: string;
}
export type ShipState = "printed" | "reprint" | "computed" | "waiting";
export interface ShipRow {
  batchId: string;
  supplierId: string;
  shipDateIso: string; // YYYY-MM-DD
  cutDateIso: string; // YYYY-MM-DD
  flowerCount: number;
  destination: string;
  state: ShipState;
}

const SHIP_META: Record<ShipState, { label: string; tone: Tone }> = {
  printed: { label: "พิมพ์แล้ว", tone: "green" },
  reprint: { label: "รอส่งพิมพ์", tone: "amber" },
  computed: { label: "คำนวณ CO₂e แล้ว", tone: "blue" },
  waiting: { label: "รอดำเนินการ", tone: "violet" },
};
const SHIP_ORDER: ShipState[] = ["waiting", "computed", "reprint", "printed"];

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-blue-500";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-600";

// YYYY-MM-DD → dd/mm/(พ.ศ.)
function fmtDate(iso: string) {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${Number(y) + 543}`;
}
// full ISO → dd/mm/(พ.ศ.) | HH:MM (local)
function fmtDateTime(iso: string) {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear() + 543} | ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
// local YYYY-MM-DD from a full ISO, for date-equality filtering
function localYMD(iso: string) {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-5 py-3.5 text-center text-[13px] font-semibold text-slate-700 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-4 text-center text-[13px] text-slate-700 ${className}`}>{children}</td>;
}

export default function LogisticHistory({ printRows, shipRows }: { printRows: PrintRow[]; shipRows: ShipRow[] }) {
  const router = useRouter();

  // ---- print-history filters ----
  const [pSup, setPSup] = useState("");
  const [pDate, setPDate] = useState("");
  const filteredPrints = useMemo(
    () =>
      printRows.filter((r) => {
        if (pSup.trim() && !`${r.supplierId} ${r.batchId}`.toLowerCase().includes(pSup.trim().toLowerCase())) return false;
        if (pDate && localYMD(r.printedAtIso) !== pDate) return false;
        return true;
      }),
    [printRows, pSup, pDate],
  );

  // ---- shipment-history filters ----
  const [sDest, setSDest] = useState("");
  const [sShip, setSShip] = useState("");
  const [sCut, setSCut] = useState("");
  const [sState, setSState] = useState("");
  const destinations = useMemo(() => [...new Set(shipRows.map((r) => r.destination).filter((d) => d && d !== "—"))], [shipRows]);
  const filteredShips = useMemo(
    () =>
      shipRows.filter((r) => {
        if (sDest && r.destination !== sDest) return false;
        if (sShip && r.shipDateIso !== sShip) return false;
        if (sCut && r.cutDateIso !== sCut) return false;
        if (sState && r.state !== sState) return false;
        return true;
      }),
    [shipRows, sDest, sShip, sCut, sState],
  );

  // ---- cancel a mistaken print ----
  const [cancelTarget, setCancelTarget] = useState<PrintRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);
  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await fetch(`/api/prints/${cancelTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelled: true }),
      });
      setCancelTarget(null);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
          <p className="text-[13px] font-semibold text-slate-800">ยกเลิกการพิมพ์เรียบร้อย</p>
        </div>
      ) : null}

      {/* ===== ประวัติการพิมพ์ QR code ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">ประวัติการพิมพ์ QR code</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>ค้นหา SUP ID</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={pSup} onChange={(e) => setPSup(e.target.value)} placeholder="ระบุ SUP ID" className={`${inputCls} pl-9`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>วันที่พิมพ์</label>
            <DateField value={pDate} onChange={setPDate} className={inputCls} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full min-w-[640px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#e9ebf8]">
                  <Th>เวลาพิมพ์</Th><Th>Batch ID</Th><Th>ปลายทาง</Th><Th>จัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {filteredPrints.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-[13px] text-slate-400">ยังไม่มีประวัติการพิมพ์</td></tr>
                ) : (
                  filteredPrints.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <Td>{fmtDateTime(r.printedAtIso)}</Td>
                      <Td className="font-mono text-[12px]">{r.batchId}</Td>
                      <Td>{r.destination}</Td>
                      <Td>
                        <button onClick={() => setCancelTarget(r)} className="mx-auto grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600" title="ยกเลิกการพิมพ์">
                          <Pencil size={16} />
                        </button>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== ประวัติการจัดส่ง ===== */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">ประวัติการจัดส่ง</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>ปลายทาง</label>
            <select value={sDest} onChange={(e) => setSDest(e.target.value)} className={inputCls}>
              <option value="">ทั้งหมด</option>
              {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>วันที่จัดส่ง</label><DateField value={sShip} onChange={setSShip} className={inputCls} /></div>
          <div><label className={labelCls}>วันที่ตัดดอกไม้</label><DateField value={sCut} onChange={setSCut} className={inputCls} /></div>
          <div>
            <label className={labelCls}>สถานะ</label>
            <select value={sState} onChange={(e) => setSState(e.target.value)} className={inputCls}>
              <option value="">ทั้งหมด</option>
              {SHIP_ORDER.map((s) => <option key={s} value={s}>{SHIP_META[s].label}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full min-w-[720px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#e9ebf8]">
                  <Th>วันที่จัดส่ง</Th><Th>Batch ID</Th><Th>จำนวนดอกไม้</Th><Th>ปลายทาง</Th><Th>สถานะ</Th>
                </tr>
              </thead>
              <tbody>
                {filteredShips.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] text-slate-400">ยังไม่มีประวัติการจัดส่ง</td></tr>
                ) : (
                  filteredShips.map((r) => (
                    <tr key={r.batchId} className="border-t border-slate-100">
                      <Td>{fmtDate(r.shipDateIso)}</Td>
                      <Td className="font-mono text-[12px]">{r.batchId}</Td>
                      <Td className="tabular">{r.flowerCount.toLocaleString("en-US")}</Td>
                      <Td>{r.destination}</Td>
                      <Td><Badge tone={SHIP_META[r.state].tone}>{SHIP_META[r.state].label}</Badge></Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="ยกเลิกการพิมพ์นี้?">
        <p className="text-[13px] text-slate-500">
          Batch <span className="font-mono">{cancelTarget?.batchId}</span> จะกลับไปสถานะ “ยังไม่ได้พิมพ์” และสามารถพิมพ์ฉลากใหม่ได้
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setCancelTarget(null)} disabled={busy} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
          <button onClick={confirmCancel} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-red-500 px-8 text-[14px] font-medium text-white hover:bg-red-600 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยันยกเลิก
          </button>
        </div>
      </Modal>
    </div>
  );
}
