import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier } from "@/lib/store";
import { FACTORS, transportCarbon, basketCarbonForRound, basketReuseCounts } from "@/lib/carbon";
import { MetricCard, Card, Donut } from "@/components/ui";
import ProLock from "@/components/ProLock";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { thaiDateShort } from "@/lib/format";
import { Leaf, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import type { Batch } from "@/lib/types";

export const dynamic = "force-dynamic";

function monthlyAvg(bs: Batch[]) {
  const m = new Map<string, { s: number; n: number }>();
  for (const b of bs) {
    const k = b.cutDate.slice(0, 7);
    const c = m.get(k) ?? { s: 0, n: 0 };
    c.s += b.co2ePerFlower; c.n += 1; m.set(k, c);
  }
  return new Map([...m].map(([k, v]) => [k, v.s / v.n]));
}

export default async function CarbonDashboardPage() {
  const user = await requireRole("supplier");
  const [supplier, batches] = await Promise.all([
    getSupplier(user.supplierId!),
    getBatchesBySupplier(user.supplierId!),
  ]);
  // Carbon dashboard is a Pro feature (freemium).
  if (supplier && supplier.plan !== "pro") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ดคาร์บอน</h1>
        <ProLock />
      </div>
    );
  }

  const { getSuppliers, getBatches } = await import("@/lib/store");
  const [allSuppliers, allBatches] = await Promise.all([getSuppliers(), getBatches()]);

  const computed = batches.filter((b) => b.status === "computed");
  const avgCo2e = computed.length ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length : 0;

  // Rank among producers (lower avg = better).
  const farmAvgs = allSuppliers
    .map((sp) => {
      const bs = allBatches.filter((b) => b.supplierId === sp.id && b.status === "computed");
      return { id: sp.id, avg: bs.length ? bs.reduce((n, b) => n + b.co2ePerFlower, 0) / bs.length : Infinity };
    })
    .filter((x) => Number.isFinite(x.avg))
    .sort((a, b) => a.avg - b.avg);
  const rank = farmAvgs.findIndex((x) => x.id === user.supplierId) + 1;

  // Month-over-month change.
  const monthly = monthlyAvg(computed);
  const months = [...monthly.keys()].sort();
  let mom: number | null = null;
  if (months.length >= 2) {
    const cur = monthly.get(months[months.length - 1])!;
    const prev = monthly.get(months[months.length - 2])!;
    if (prev > 0) mom = ((cur - prev) / prev) * 100;
  }

  // Emission by activity (aggregate over computed rounds).
  // Per-activity breakdown — mirrors plantingCarbon()/carbon.ts exactly (all six farm inputs,
  // accumulated per computed round) so the donut always sums to the same total as the engine.
  const reuse = basketReuseCounts(batches);
  let fuel = 0, elec = 0, fert = 0, agro = 0, water = 0, waste = 0, transport = 0, packaging = 0;
  for (const b of computed) {
    fuel += (supplier?.fuelLitres ?? 0) * FACTORS.FUEL;
    elec += (supplier?.electricityKwh ?? 0) * FACTORS.ELECTRICITY;
    fert += (supplier?.fertilizerKg ?? 0) * FACTORS.FERTILIZER;
    agro += (supplier?.agriChemicalsKg ?? 0) * FACTORS.AGROCHEMICAL;
    water += (supplier?.waterM3 ?? 0) * FACTORS.WATER;
    waste += (supplier?.wasteKg ?? 0) * FACTORS.WASTE;
    transport += transportCarbon(b.distanceKm);
    packaging += basketCarbonForRound(b.basketIds ?? [], (id) => reuse.get(id) ?? 0);
  }
  const activities = [
    { label: "ปุ๋ยเคมี", val: fert, color: "#5ec46e" },
    { label: "สารเคมีเกษตร", val: agro, color: "#f472b6" },
    { label: "การใช้ไฟฟ้า", val: elec, color: "#1262fe" },
    { label: "การใช้เชื้อเพลิง", val: fuel, color: "#ff8d28" },
    { label: "การใช้น้ำ", val: water, color: "#38bdf8" },
    { label: "การขนส่ง", val: transport, color: "#5eead4" },
    { label: "บรรจุภัณฑ์", val: packaging, color: "#a78bfa" },
    { label: "การจัดการของเสีย", val: waste, color: "#ff383c" },
  ].filter((a) => a.val > 0);
  const actTotal = activities.reduce((n, a) => n + a.val, 0) || 1;
  const segments = activities.map((a) => ({ label: a.label, pct: Math.round((a.val / actTotal) * 100), color: a.color }));

  const rows = [...computed].sort((a, b) => b.cutDate.localeCompare(a.cutDate));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ดคาร์บอน</h1>
        <Co2eDisclosure className="mt-1.5 max-w-3xl" />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="CO₂e เฉลี่ยต่อดอก" value={avgCo2e.toFixed(4)} unit="กิโลกรัม" tone="green" icon={<Leaf size={20} />} note="อัปเดตล่าสุด : วันนี้" />
        <MetricCard label="อันดับเมื่อเทียบกับผู้ผลิตรายอื่น" value={rank > 0 ? `อันดับที่ ${rank}` : "—"} tone="pink" icon={<Trophy size={20} />} note={`จาก ${farmAvgs.length} ผู้ผลิต`} />
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-slate-500">เปลี่ยนแปลงจากเดือนก่อน</div>
              <div className="mt-1 flex items-center gap-1.5 text-3xl font-bold tabular">
                {mom == null ? <span className="text-slate-400">—</span> : mom <= 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600"><TrendingDown size={24} /> {mom.toFixed(0)} %</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500"><TrendingUp size={24} /> +{mom.toFixed(0)} %</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Details table */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-800">รายละเอียดการปล่อย CO₂e</h2>
            <span className="text-xs text-slate-400">Result {rows.length} รายการ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">ลำดับ</th>
                  <th className="px-4 py-2 font-medium">วันที่จัดส่ง</th>
                  <th className="px-4 py-2 text-right font-medium">จำนวนดอกไม้</th>
                  <th className="px-4 py-2 text-right font-medium">อายุหลังตัด (วัน)</th>
                  <th className="px-4 py-2 text-right font-medium">CO₂e รวม (kg)</th>
                  <th className="px-4 py-2 text-right font-medium">CO₂e ต่อดอก (kg)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">ยังไม่มีรอบที่คำนวณแล้ว</td></tr>
                ) : rows.map((b, i) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 tabular text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2.5 text-slate-700">{thaiDateShort(b.cutDate)}</td>
                    <td className="px-4 py-2.5 text-right tabular">{b.flowerCount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular">{b.ageDays}</td>
                    <td className="px-4 py-2.5 text-right tabular">{(b.co2ePerFlower * b.flowerCount).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular text-slate-800">{b.co2ePerFlower.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Activity breakdown */}
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">สัดส่วนการปล่อย CO₂e ตามกิจกรรม</h2>
          {segments.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีข้อมูลที่คำนวณแล้ว</p>
          ) : (
            <div className="space-y-4">
              <Donut segments={segments} centerTop="รวม" centerValue={actTotal.toFixed(1)} centerUnit="kgCO₂e" />
              <ul className="space-y-2 text-sm">
                {activities.map((a) => (
                  <li key={a.label} className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: a.color }} />
                    <span className="text-slate-600">{a.label}</span>
                    <span className="ml-auto tabular text-slate-400">{a.val.toFixed(1)} kgCO₂e</span>
                    <span className="w-10 text-right tabular font-medium text-slate-800">{Math.round((a.val / actTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
