import { FACTORS, FACTOR_LABELS, FACTOR_SOURCE } from "@/lib/carbon";
import { MetricCard, Card, Donut, DONUT_COLORS } from "@/components/ui";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { Truck, Package, Cloud, Leaf, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { Supplier, Batch } from "@/lib/types";
import { batchCo2e, quantityLabel } from "@/lib/produce";
import { DASH } from "@/lib/format";
import { amountsOf, amountText, avgCo2e as avgOf, modeFor, perLabel, unitMode, AMOUNT_UNIT } from "@/lib/amounts";
import type { KynFilter } from "@/lib/kyn-filter";
import { KynCategoryChips, KynFarmPeriod } from "@/components/KynFilters";

// `batches` arrive already filtered (ประเภทสินค้า / ฟาร์ม / ช่วงเวลา, lib/kyn-filter.ts); amounts and averages
// follow the unit of what is shown (lib/amounts.ts).
export default function KynOverviewSection({
  suppliers,
  batches,
  filter,
  farms,
}: {
  suppliers: Supplier[];
  batches: Batch[];
  filter: KynFilter;
  farms: { id: string; name: string }[];
}) {
  const byId = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  const computed = batches.filter((b) => b.status === "computed");
  const rows = [...computed].sort((a, b) => b.id.localeCompare(a.id));

  const mode = modeFor(unitMode(computed), filter.cat);
  const amounts = amountsOf(computed);
  const totalCo2e = computed.reduce((n, b) => n + batchCo2e(b), 0);
  const avgCo2e = avgOf(computed, mode); // nothing to divide by → "–"

  const perFarm = suppliers
    .map((s) => ({
      s,
      total: computed
        .filter((b) => b.supplierId === s.id)
        .reduce((n, b) => n + batchCo2e(b), 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const farmTotal = perFarm.reduce((n, r) => n + r.total, 0) || 1;
  const segments = perFarm.map((r, i) => ({
    label: r.s.farmName,
    pct: Math.round((r.total / farmTotal) * 100),
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">ภาพรวมระบบ</h1>
        <div className="flex flex-wrap items-center gap-2"><KynFarmPeriod value={filter} farms={farms} /></div>
      </div>
      <KynCategoryChips value={filter} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="จำนวนแบตช์" value={computed.length} unit="รอบ" tone="blue" icon={<Truck size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label={mode === "kg" ? "น้ำหนักสินค้าทั้งหมด" : mode === "mixed" ? "ปริมาณสินค้าทั้งหมด" : `จำนวน${AMOUNT_UNIT[mode]}ทั้งหมด`} value={amountText(amounts, mode)} unit={mode === "mixed" ? undefined : AMOUNT_UNIT[mode]} tone="green" icon={<Package size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="การปล่อย CO₂e รวม" value={totalCo2e.toFixed(1)} unit="กิโลกรัม" tone="blue" icon={<Cloud size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label={`CO₂e เฉลี่ยต่อ${perLabel(mode)}`} value={avgCo2e == null ? DASH : avgCo2e.toFixed(mode === "mixed" ? 2 : 4)} unit={avgCo2e == null ? undefined : "กิโลกรัม"} tone="green" icon={<Leaf size={20} />} note="อัปเดตล่าสุด : วันนี้" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-500"><Leaf size={18} /></span>
            <div>
              <h2 className="text-base font-semibold text-slate-800">ผลการคำนวณแต่ละล็อต</h2>
              <p className="mt-0.5 text-sm text-slate-500">data ที่ต้องคำนวณ (คาร์บอน + อายุ)</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="tbl w-full min-w-[620px] text-sm">
              <thead>
                <tr className="bg-brand-purple-head text-white">
                  <th className="px-4 py-3 text-left font-semibold">รหัสล็อต</th>
                  <th className="px-4 py-3 text-left font-semibold">ชื่อฟาร์ม</th>
                  <th className="px-4 py-3 text-right font-semibold">จำนวน</th>
                  <th className="px-4 py-3 text-right font-semibold">ระยะทาง (กม.)</th>
                  <th className="px-4 py-3 text-right font-semibold">CO₂e kg</th>
                  <th className="px-4 py-3 text-right font-semibold">อายุหลังเก็บเกี่ยว (วัน)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">ยังไม่มีข้อมูลที่คำนวณแล้ว</td>
                  </tr>
                ) : (
                  rows.map((b) => {
                    const s = byId.get(b.supplierId);
                    return (
                      <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.id}</td>
                        <td className="px-4 py-3 text-slate-800" title={String(s?.farmName ?? "–")}><span className="cell-clip">{s?.farmName ?? "–"}</span></td>
                        <td className="px-4 py-3 text-right tabular">{quantityLabel(b)}</td>
                        <td className="px-4 py-3 text-right tabular">{b.distanceKm}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-slate-800">{(batchCo2e(b)).toFixed(3)}</td>
                        <td className="px-4 py-3 text-right tabular text-slate-600">{b.ageDays}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Result {rows.length} รายการ</span>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>1 - {Math.min(50, rows.length)} of {rows.length}</span>
              <div className="flex gap-1">
                <button className="grid size-7 place-items-center rounded-md bg-brand-purple text-white"><ChevronLeft size={14} /></button>
                <button className="grid size-7 place-items-center rounded-md bg-brand-purple text-white"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-800">สัดส่วนการปล่อย CO₂e</h2>
            <p className="mt-0.5 text-sm text-slate-500">kg CO₂e ต่อฟาร์ม</p>
            <div className="mt-4">
              {segments.length === 0 ? (
                <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
              ) : (
                <Donut segments={segments} centerValue={totalCo2e.toFixed(0)} centerUnit="kg" />
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-purple-light text-brand-purple"><SlidersHorizontal size={18} /></span>
              <div>
                <h2 className="text-base font-semibold text-slate-800">ค่าสัมประสิทธิ์คาร์บอน</h2>
                <p className="mt-0.5 text-sm text-slate-500">Emission factors</p>
              </div>
            </div>
            <div className="mt-3">
              <table className="tbl w-full text-sm">
                <tbody>
                  {(Object.keys(FACTORS) as (keyof typeof FACTORS)[]).map((k) => (
                    <tr key={k} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 text-slate-600">{FACTOR_LABELS[k]}</td>
                      <td className="py-1.5 text-right font-semibold tabular text-slate-800">{FACTORS[k]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <a href={FACTOR_SOURCE.url} target="_blank" rel="noreferrer" className="mt-3 block text-[11px] text-slate-400 hover:text-brand-purple">
                {FACTOR_SOURCE.label} ↗
              </a>
              <Co2eDisclosure className="mt-2" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
