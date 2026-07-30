"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Printer, Loader2, Check, Ban, RotateCcw } from "lucide-react";
import { StatCard } from "@/components/ui";
import QrLabel from "@/components/QrLabel";
import Modal from "@/components/Modal";
import { isSameBangkokDay, thaiDateTime } from "@/lib/format";
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
  const [selectedSup, setSelectedSup] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<Batch | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const supById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  // A batch is "printed" only if it has an active (non-cancelled) print log.
  const activePrintedBatchIds = useMemo(
    () => new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId)),
    [prints],
  );

  // Computed batches not yet printed, grouped by supplier.
  const unprintedBySup = useMemo(() => {
    const m = new Map<string, Batch[]>();
    for (const b of batches) {
      if (b.status !== "computed") continue;
      if (activePrintedBatchIds.has(b.id)) continue;
      (m.get(b.supplierId) ?? m.set(b.supplierId, []).get(b.supplierId)!).push(b);
    }
    return m;
  }, [batches, activePrintedBatchIds]);

  // Search results: only SUPs that still have something to print (by id OR name).
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter((s) => (unprintedBySup.get(s.id)?.length ?? 0) > 0)
      .filter(
        (s) =>
          !q ||
          s.id.toLowerCase().includes(q) ||
          s.farmName.toLowerCase().includes(q),
      );
  }, [suppliers, unprintedBySup, query]);

  const selected = selectedSup ? supById.get(selectedSup) : null;
  const selectedBatches = selectedSup ? unprintedBySup.get(selectedSup) ?? [] : [];

  // Today summary.
  const nowIso = new Date().toISOString();
  const printedToday = prints.filter(
    (p) => !p.cancelled && isSameBangkokDay(p.printedAt, nowIso),
  ).length;
  const waiting = [...unprintedBySup.values()].reduce((n, arr) => n + arr.length, 0);
  const sortingPoints = new Set(
    prints.filter((p) => p.sortingPoint).map((p) => p.sortingPoint),
  ).size;

  function doPrint(b: Batch) {
    setPrintTarget(b);
    setTimeout(() => {
      window.print();
      setConfirmOpen(true);
    }, 60);
  }

  async function confirmPrinted() {
    if (!printTarget || !selected) return;
    setBusy(true);
    await fetch("/api/prints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: selected.id,
        batchId: printTarget.id,
        destination: printTarget.destination,
        printedBy: "Thaipost",
      }),
    });
    setBusy(false);
    setConfirmOpen(false);
    setPrintTarget(null);
    setSelectedSup(null);
    router.refresh();
  }

  async function cancelPrint(id: string) {
    setCancelBusy(id);
    await fetch(`/api/prints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelled: true }),
    });
    setCancelBusy(null);
    router.refresh();
  }

  const historyRows = [...prints].sort((a, b) => b.printedAt.localeCompare(a.printedAt));

  return (
    <>
      <div className="no-print mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Today */}
        <section className="grid grid-cols-3 gap-4">
          <StatCard label="พิมพ์แล้ววันนี้" value={printedToday} accent="blue" />
          <StatCard label="รอค้นหา/พิมพ์" value={waiting} accent="orange" />
          <StatCard label="จุดคัดแยก" value={sortingPoints} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Search + results */}
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">ค้นหา SUP (ยังไม่ได้พิมพ์)</h1>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm">
              <Search size={18} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาด้วยชื่อฟาร์ม หรือ SUP ID"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {results.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  ไม่มี SUP ที่ค้างพิมพ์
                </p>
              ) : (
                results.map((s) => {
                  const n = unprintedBySup.get(s.id)?.length ?? 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSup(s.id)}
                      className={`flex w-full items-center justify-between border-b border-slate-50 px-5 py-3 text-left last:border-0 ${
                        selectedSup === s.id ? "bg-pink-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <span>
                        <span className="font-medium text-slate-800">{s.farmName}</span>
                        <span className="ml-2 font-mono text-xs text-slate-400">{s.id}</span>
                      </span>
                      <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-700">
                        {n} รอพิมพ์
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Label preview for the selected SUP */}
          <div className="space-y-4">
            {selected && selectedBatches.length > 0
              ? selectedBatches.map((b) => (
                  <div key={b.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <QrLabel supplier={selected} batch={b} traceUrl={`${origin}/trace/${b.id}`} />
                    <div className="text-center">
                      <button
                        onClick={() => doPrint(b)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Printer size={16} /> พิมพ์ฉลาก
                      </button>
                    </div>
                  </div>
                ))
              : (
                <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                  เลือก SUP จากรายการเพื่อออกฉลาก
                </div>
              )}
          </div>
        </div>

        {/* Print history with cancel/reprint */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-800">ประวัติการพิมพ์</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-medium">SUP ID</th>
                  <th className="px-5 py-2.5 font-medium">ปลายทาง</th>
                  <th className="px-5 py-2.5 font-medium">เวลาพิมพ์</th>
                  <th className="px-5 py-2.5 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400">ยังไม่มีการพิมพ์</td>
                  </tr>
                ) : (
                  historyRows.map((p) => (
                    <tr key={p.id} className={`border-b border-slate-50 last:border-0 ${p.cancelled ? "opacity-50" : ""}`}>
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-600">
                        {p.supplierId}
                        {p.batchId ? <span className="ml-1 text-slate-400">· {p.batchId}</span> : null}
                      </td>
                      <td className="px-5 py-2.5 text-slate-700">{p.destination ?? "—"}</td>
                      <td className="px-5 py-2.5 text-slate-600">
                        {p.cancelled ? <span className="line-through">{thaiDateTime(p.printedAt)}</span> : thaiDateTime(p.printedAt)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {p.cancelled ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Ban size={13} /> ยกเลิกแล้ว
                          </span>
                        ) : (
                          <button
                            onClick={() => cancelPrint(p.id)}
                            disabled={cancelBusy === p.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            {cancelBusy === p.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            ยกเลิก (พิมพ์ผิด)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            กด “ยกเลิก” เมื่อพิมพ์ผิด — รายการนั้นจะถูกยกเลิก และ SUP จะกลับมาให้ค้นหา/พิมพ์ใหม่เป็นรายการใหม่
          </p>
        </div>
      </div>

      {/* Confirm-after-print (กัน Human error) */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="ยืนยันการพิมพ์">
        <p className="text-sm text-slate-600">
          พิมพ์ฉลาก <b>{printTarget?.id}</b> สำเร็จหรือไม่?
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={confirmPrinted}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            ยืนยันพิมพ์สำเร็จ
          </button>
          <button
            onClick={() => printTarget && doPrint(printTarget)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer size={16} /> พิมพ์ใหม่
          </button>
        </div>
      </Modal>

      {/* Print-only label */}
      <div className="print-only">
        {printTarget && selected ? (
          <QrLabel supplier={selected} batch={printTarget} traceUrl={`${origin}/trace/${printTarget.id}`} />
        ) : null}
      </div>
    </>
  );
}
