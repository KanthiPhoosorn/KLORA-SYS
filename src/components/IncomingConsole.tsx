"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { computeCarbon, basketCarbonForRound, basketReuseCounts } from "@/lib/carbon";
import { thaiDateShort } from "@/lib/format";
import type { Supplier, Batch } from "@/lib/types";

export default function IncomingConsole({
  suppliers,
  batches,
}: {
  suppliers: Supplier[];
  batches: Batch[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const supById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers],
  );

  // One row per SUP that has any batches, newest activity first.
  const supRows = useMemo(() => {
    return suppliers
      .map((s) => {
        const bs = batches.filter((b) => b.supplierId === s.id);
        const submitted = bs.filter((b) => b.status === "submitted");
        const latest = [...bs].sort((a, b) => b.cutDate.localeCompare(a.cutDate))[0];
        return { s, count: bs.length, submitted: submitted.length, latest };
      })
      .filter((r) => r.count > 0)
      .filter(
        (r) =>
          !q ||
          r.s.id.toLowerCase().includes(q.toLowerCase()) ||
          r.s.farmName.includes(q),
      )
      .sort((a, b) => b.submitted - a.submitted);
  }, [suppliers, batches, q]);

  const [selectedId, setSelectedId] = useState<string | null>(
    supRows.find((r) => r.submitted > 0)?.s.id ?? supRows[0]?.s.id ?? null,
  );
  const selected = selectedId ? supById.get(selectedId) : null;
  const selectedBatches = selected
    ? batches
        .filter((b) => b.supplierId === selected.id)
        .sort((a, b) => b.cutDate.localeCompare(a.cutDate))
    : [];
  const ready = selectedBatches.filter(
    (b) => b.status === "submitted" && (b.basketIds?.length ?? 0) > 0,
  );
  const pendingSubmitted = selectedBatches.filter((b) => b.status === "submitted");

  async function confirmAll() {
    if (!ready.length) return;
    setBusy(true);
    await Promise.all(
      ready.map((b) =>
        fetch(`/api/batches/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "compute" }),
        }),
      ),
    );
    setBusy(false);
    router.refresh();
  }

  // Preview figures from the newest submitted batch (basket reuse counted across the farm).
  const preview = pendingSubmitted[0];
  const previewCo2e =
    preview && selected
      ? (() => {
          const reuse = basketReuseCounts(
            batches.filter((b) => b.supplierId === selected.id),
          );
          const basketRound = basketCarbonForRound(
            preview.basketIds ?? [],
            (id) => reuse.get(id) ?? 0,
          );
          return computeCarbon(selected, preview.flowerCount, preview.distanceKm, basketRound)
            .co2ePerFlower;
        })()
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Incoming list */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">ข้อมูลที่รับเข้าจาก SUP</h2>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search size={16} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา SUP ID / ฟาร์ม"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">SUP ID</th>
                <th className="px-4 py-2 font-medium">ฟาร์ม</th>
                <th className="px-4 py-2 text-right font-medium">จำนวน</th>
                <th className="px-4 py-2 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {supRows.map((r) => (
                <tr
                  key={r.s.id}
                  onClick={() => setSelectedId(r.s.id)}
                  className={`cursor-pointer border-b border-slate-50 ${
                    selectedId === r.s.id ? "bg-blue-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.s.id}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.s.farmName}</td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {r.latest ? r.latest.flowerCount.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.submitted > 0 ? (
                      <Badge tone="amber">ต้องคำนวณ</Badge>
                    ) : (
                      <Badge tone="green">คำนวณแล้ว</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {selected.id} · {selected.farmName}
              </h3>
              <p className="text-sm text-slate-500">
                {selected.flowerType}
                {selectedBatches[0] ? ` · ${selectedBatches[0].distanceKm} กม.` : ""}
              </p>
            </div>
            {pendingSubmitted.length > 0 ? (
              <span className="text-sm font-medium text-orange-600">
                {pendingSubmitted.length} รายการรอตรวจสอบ
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">Batch</th>
                  <th className="px-3 py-2 text-right font-medium">ดอก</th>
                  <th className="px-3 py-2 font-medium">วันที่ตัด</th>
                  <th className="px-3 py-2 text-right font-medium">อายุ</th>
                  <th className="px-3 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {selectedBatches.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{b.id}</td>
                    <td className="px-3 py-2.5 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-slate-700">{thaiDateShort(b.cutDate)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{b.ageDays} วัน</td>
                    <td className="px-3 py-2.5">
                      {b.status === "computed" ? (
                        <Badge tone="green">คำนวณแล้ว</Badge>
                      ) : (b.basketIds?.length ?? 0) > 0 ? (
                        <Badge tone="green">ครบ · พร้อมคำนวณ</Badge>
                      ) : (
                        <Badge tone="amber">ขาดตะกร้า</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={confirmAll}
            disabled={busy || ready.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            ยืนยันทั้งหมดที่พร้อมคำนวณ{ready.length ? ` (${ready.length})` : ""}
          </button>

          {preview && selected ? (
            <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-slate-500">คาร์บอนฟุตพรินท์ (ประมาณการ)</div>
                <div className="mt-1 flex items-baseline gap-3 text-sm">
                  <span className="text-slate-500">Fuel {selected.fuelLitres ?? 0} ลิตร</span>
                  <span className="text-slate-500">· {preview.distanceKm} กม.</span>
                </div>
                <div className="mt-1 text-lg font-bold tabular text-slate-900">
                  {previewCo2e != null ? previewCo2e.toFixed(3) : "—"}{" "}
                  <span className="text-xs font-medium text-slate-400">กก./ดอก</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">ระยะเวลาหลังตัด</div>
                <div className="mt-1 text-sm text-slate-500">
                  ตัด {thaiDateShort(preview.cutDate)} · ลงข้อมูล {thaiDateShort(preview.entryDate)}
                </div>
                <div className="mt-1 text-lg font-bold tabular text-slate-900">
                  {preview.ageDays} <span className="text-xs font-medium text-slate-400">วัน</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 p-10 text-sm text-slate-400">
          ไม่มีข้อมูลรับเข้า
        </div>
      )}
    </div>
  );
}
