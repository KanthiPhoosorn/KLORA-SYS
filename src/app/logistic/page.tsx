import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import { MetricCard, Card, Donut, DONUT_COLORS } from "@/components/ui";
import BranchTable, { type BranchRow } from "@/components/BranchTable";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { isSameBangkokDay } from "@/lib/format";
import { VEHICLE_PROFILE, FUEL_EF } from "@/lib/transport-ef";
import { DESTINATIONS } from "@/lib/geo";
import { Printer, Search, MapPin, Truck, Package, Cloud, Boxes, Snowflake, Globe, Users } from "lucide-react";
import type { Supplier, Batch } from "@/lib/types";

export const dynamic = "force-dynamic";

const nfmt = (n: number) => n.toLocaleString("en-US");
const provinceOf = (branch?: string) => DESTINATIONS.find((d) => branch?.includes(d.province) || branch?.includes(d.name))?.province ?? "—";
const vehLabel = (k?: string) => (k && VEHICLE_PROFILE[k]?.label) || "—";
const fuelLabel = (k?: string) => (k && FUEL_EF[k]?.label) || "—";
const transportOf = (b: Batch) => b.carbonBreakdown?.transport ?? 0;

export default async function LogisticDashboard() {
  await requireRole("logistic");
  const [suppliers, batches, prints] = await Promise.all([getSuppliers(), getBatches(), getPrints()]);
  const byId = new Map<string, Supplier>(suppliers.map((s) => [s.id, s]));
  const computed = batches.filter((b) => b.status === "computed");

  const nowIso = new Date().toISOString();
  const printedToday = prints.filter((p) => !p.cancelled && isSameBangkokDay(p.printedAt, nowIso)).length;
  const printedBatchIds = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));
  const waiting = computed.filter((b) => !printedBatchIds.has(b.id)).length;
  const sortingPoints = new Set(prints.filter((p) => p.sortingPoint).map((p) => p.sortingPoint)).size;
  const latestDate = prints.length ? prints[prints.length - 1].printedAt.slice(0, 10) : nowIso.slice(0, 10);

  const totalFlowers = computed.reduce((n, b) => n + b.flowerCount, 0);
  const totalCo2e = computed.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
  const avgCo2e = computed.length ? computed.reduce((n, b) => n + b.co2ePerFlower, 0) / computed.length : 0;
  const reeferPct = computed.length ? Math.round((computed.filter((b) => b.isReeferUsed).length / computed.length) * 100) : 0;
  // ต่างประเทศ = ส่งผ่าน "ผู้ส่งออก"; ที่เหลือคือในประเทศ
  const intlCount = computed.filter((b) => (b.carrier ?? "").includes("ส่งออก")).length;
  const intlPct = computed.length ? Math.round((intlCount / computed.length) * 100) : 0;
  const domesticPct = 100 - intlPct;

  // ผู้ผลิตที่ใช้งานภายใน 30 วัน
  const cutoff = Date.now() - 30 * 86400000;
  const activeProducers = new Set(
    computed.filter((b) => new Date(b.createdAt).getTime() >= cutoff).map((b) => b.supplierId),
  ).size || suppliers.length;

  // Donut — สัดส่วนปริมาณดอกไม้รับเข้าตามฟาร์ม (นับจำนวนดอก)
  const perFarm = suppliers
    .map((s) => ({ s, flowers: computed.filter((b) => b.supplierId === s.id).reduce((n, b) => n + b.flowerCount, 0) }))
    .filter((r) => r.flowers > 0)
    .sort((a, b) => b.flowers - a.flowers);
  const farmFlowerTotal = perFarm.reduce((n, r) => n + r.flowers, 0) || 1;
  const donutSegments = perFarm.slice(0, 4).map((r, i) => ({
    label: r.s.farmName,
    pct: Math.round((r.flowers / farmFlowerTotal) * 100),
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  // สถิติจังหวัดปลายทาง — top 5 destinations by round count
  const destCounts = new Map<string, number>();
  for (const b of computed) if (b.destination) destCounts.set(b.destination, (destCounts.get(b.destination) ?? 0) + 1);
  const destMax = Math.max(1, ...destCounts.values());
  const topDests = [...destCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ranked producers by rounds (head-office list)
  const producerRounds = suppliers
    .map((s) => ({ s, rounds: computed.filter((b) => b.supplierId === s.id).length }))
    .filter((r) => r.rounds > 0)
    .sort((a, b) => b.rounds - a.rounds)
    .slice(0, 5);

  const rows = [...computed].sort((a, b) => b.id.localeCompare(a.id));

  // Branch comparison (ข้อมูลรายสาขา)
  const branchMap = new Map<string, Batch[]>();
  for (const b of computed) {
    const key = b.branch || "ไม่ระบุสาขา";
    (branchMap.get(key) ?? branchMap.set(key, []).get(key)!).push(b);
  }
  const branchRows: BranchRow[] = [...branchMap.entries()].map(([branch, list]) => {
    const flowers = list.reduce((n, b) => n + b.flowerCount, 0);
    const co2eTotal = list.reduce((n, b) => n + b.co2ePerFlower * b.flowerCount, 0);
    return {
      province: provinceOf(branch),
      branch,
      rounds: list.length,
      flowers,
      transportCo2e: list.reduce((n, b) => n + transportOf(b), 0),
      avgPerStem: flowers ? co2eTotal / flowers : 0,
      trend: null,
    };
  }).sort((a, b) => b.rounds - a.rounds);

  const Tile = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
    <div className="rounded-xl bg-white/80 p-4">
      <div className="flex items-center justify-between text-slate-500"><span className="text-xs">{label}</span><span className="text-blue-500">{icon}</span></div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-400">Latest date : {latestDate}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overview banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr] lg:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ภาพรวมการขนส่ง</h1>
            <p className="mt-1 text-sm text-slate-500">ติดตามการส่งพัสดุและการปล่อยคาร์บอนจากการขนส่งของคุณ</p>
            <Link href="/logistic/search" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Search size={16} /> ค้นหา / พิมพ์ QR
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="พิมพ์แล้ววันนี้" value={printedToday} icon={<Printer size={16} />} />
            <Tile label="รอค้นหา" value={waiting} icon={<Search size={16} />} />
            <Tile label="จุดคัดแยก" value={sortingPoints} icon={<MapPin size={16} />} />
          </div>
        </div>
      </div>

      {/* 6 metric cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="จำนวนรอบการจัดส่ง" value={computed.length} unit="รอบ" tone="blue" icon={<Truck size={20} />} note={`อัปเดตล่าสุด : ${latestDate}`} />
        <MetricCard label="จำนวนดอกทั้งหมด" value={nfmt(totalFlowers)} unit="ดอก" tone="green" icon={<Package size={20} />} note={`อัปเดตล่าสุด : ${latestDate}`} />
        <MetricCard label="การปล่อย CO₂e รวม" value={totalCo2e.toFixed(1)} unit="กิโลกรัม" tone="blue" icon={<Cloud size={20} />} note={`อัปเดตล่าสุด : ${latestDate}`} />
        <MetricCard label="CO₂e ขนส่งเฉลี่ย/ดอก" value={avgCo2e.toFixed(4)} unit="กิโลกรัม" tone="blue" icon={<Boxes size={20} />} note={`อัปเดตล่าสุด : ${latestDate}`} />
        <MetricCard label="การใช้ตู้เย็นหรือห้องเย็น" value={`${reeferPct}`} unit="%" tone="green" icon={<Snowflake size={20} />} note={`อัปเดตล่าสุด : ${latestDate}`} />
        <MetricCard
          label="สัดส่วนการปล่อย CO₂e ในประเทศ vs ต่างประเทศ"
          value={<span className="text-blue-600">{domesticPct}%<span className="ml-4 text-emerald-500">{intlPct}%</span></span>}
          tone="blue"
          icon={<Globe size={20} />}
          note="ในประเทศ · ต่างประเทศ"
        />
      </section>

      {/* Producers / donut / province bars */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-800">จำนวนผู้ผลิตในระบบ</h3>
              <div className="mt-2 text-3xl font-bold text-blue-600">{nfmt(activeProducers)} <span className="text-sm font-medium text-slate-400">ราย</span></div>
              <p className="text-xs text-slate-400">มีการใช้งานภายใน 30 วัน</p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-500"><Users size={20} /></span>
          </div>
          <ol className="mt-4 space-y-2 text-sm">
            {producerRounds.length === 0 ? (
              <li className="text-slate-400">ยังไม่มีข้อมูล</li>
            ) : (
              producerRounds.map((r, i) => (
                <li key={r.s.id} className="flex items-center justify-between">
                  <span className="truncate text-slate-600">{i + 1}. {r.s.farmName}</span>
                  <span className="tabular font-medium text-slate-800">{r.rounds} รอบ</span>
                </li>
              ))
            )}
          </ol>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-800">สัดส่วนปริมาณดอกไม้รับเข้าตามฟาร์ม</h3>
          <Donut segments={donutSegments} centerValue={nfmt(farmFlowerTotal)} centerUnit="ดอก" />
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-800">สถิติจังหวัดปลายทาง</h3>
          <ol className="space-y-3">
            {topDests.length === 0 ? (
              <li className="text-sm text-slate-400">ยังไม่มีข้อมูล</li>
            ) : (
              topDests.map(([name, count], i) => (
                <li key={name} className="flex items-center gap-3 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] text-slate-500">{i + 1}</span>
                  <span className="w-16 shrink-0 truncate text-slate-600">{name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(count / destMax) * 100}%`, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  </div>
                  <span className="w-10 shrink-0 text-right tabular text-slate-500">{Math.round((count / (computed.length || 1)) * 100)}%</span>
                </li>
              ))
            )}
          </ol>
        </Card>
      </div>

      {/* Batch table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">ผลการคำนวณแต่ละ Batch</h2>
          <span className="text-sm text-slate-400">Result {rows.length} รายการ</span>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-blue-50 text-left text-slate-600">
                <th className="px-5 py-3 font-semibold">Batch ID</th>
                <th className="px-5 py-3 font-semibold">ต้นทาง</th>
                <th className="px-5 py-3 font-semibold">ปลายทาง</th>
                <th className="px-5 py-3 text-right font-semibold">ระยะทาง</th>
                <th className="px-5 py-3 font-semibold">ยานพาหนะ</th>
                <th className="px-5 py-3 font-semibold">เชื้อเพลิง</th>
                <th className="px-5 py-3 text-center font-semibold">ห้องเย็น</th>
                <th className="px-5 py-3 text-right font-semibold">CO₂e</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">ยังไม่มีข้อมูล</td></tr>
              ) : (
                rows.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{b.id}</td>
                    <td className="px-5 py-3 text-slate-700">{byId.get(b.supplierId)?.farmName ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-700">{b.destination ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular">{b.distanceKm}</td>
                    <td className="px-5 py-3 text-slate-600">{vehLabel(b.vehicleKey)}</td>
                    <td className="px-5 py-3 text-slate-600">{fuelLabel(b.fuelKey)}</td>
                    <td className="px-5 py-3 text-center">{b.isReeferUsed ? <span className="text-blue-500">ใช้</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 text-right"><span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 tabular">{b.co2ePerFlower.toFixed(3)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        <Co2eDisclosure />
      </div>

      {/* ข้อมูลรายสาขา (head-office view) */}
      <div className="space-y-3 pt-2">
        <h2 className="text-lg font-bold text-slate-800">รายละเอียดสาขา</h2>
        <BranchTable rows={branchRows} />
      </div>
    </div>
  );
}
