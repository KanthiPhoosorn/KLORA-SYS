import { getBatch, getSupplier } from "@/lib/store";
import { buildTraceSummary, type TraceSummary } from "@/lib/trace-summary";
import SuperAppPrototype, { type DemoOrder } from "@/components/SuperAppPrototype";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata = { title: "Super App Prototype · KLORA" };
export const dynamic = "force-dynamic";

// Demo orders for the 18 Sep walkthrough: each order line points at a REAL KLORA batch, so the
// "รายละเอียดสินค้า" screen shows live traceability data through the same JSON a partner app
// would call (GET /api/trace/[batchId]). Missing batches are skipped so the page never breaks.
const DEMO_ORDERS: { orderNo: string; date: string; status: string; items: { batchId: string; qty: string; price: number }[] }[] = [
  { orderNo: "TH2609160001", date: "2026-09-16", status: "กำลังจัดส่ง", items: [{ batchId: "BAT-2026-0007", qty: "5 กก.", price: 650 }, { batchId: "BAT-2026-0008", qty: "1 กก.", price: 120 }] },
  { orderNo: "TH2609150042", date: "2026-09-15", status: "จัดส่งสำเร็จ", items: [{ batchId: "BAT-2026-0009", qty: "2 หวี", price: 180 }] },
  { orderNo: "TH2609120118", date: "2026-09-12", status: "จัดส่งสำเร็จ", items: [{ batchId: "BAT-2026-0001", qty: "20 ดอก", price: 890 }] },
];

export default async function SuperAppPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const orders: DemoOrder[] = [];
  for (const o of DEMO_ORDERS) {
    const items: DemoOrder["items"] = [];
    for (const it of o.items) {
      const b = await getBatch(it.batchId);
      const s = b ? await getSupplier(b.supplierId) : null;
      if (!b || !s) continue;
      const trace: TraceSummary = buildTraceSummary(b, s, origin);
      items.push({ ...it, trace });
    }
    if (items.length) orders.push({ ...o, items });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex h-[60px] items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold tracking-tight text-brand-pink">KLORA</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">ต้นแบบ · Prototype</span>
          <span className="hidden text-sm text-slate-500 sm:inline">แนวคิดการแสดงข้อมูล KLORA ใน Super App ของพันธมิตรขนส่ง</span>
        </div>
        <Link href="/superapp/concept" className="text-sm font-medium text-brand-pink hover:underline">แนวคิดการเชื่อมข้อมูล →</Link>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-8 lg:flex-row lg:items-start lg:justify-center">
        <SuperAppPrototype orders={orders} />
        <aside className="max-w-sm space-y-4 text-[14px] leading-relaxed text-slate-600">
          <h1 className="text-xl font-bold text-slate-900">Journey 02 — ดูข้อมูลสินค้าจากรายการสั่งซื้อ</h1>
          <ol className="list-decimal space-y-2 pl-5">
            <li>ลูกค้าเปิด Super App → เมนู <b>ของสด / ดอกไม้</b></li>
            <li><b>My Item</b> → รายการสั่งซื้อของตัวเอง</li>
            <li>เลือกสินค้าในออเดอร์ → <b>รายละเอียดสินค้า</b></li>
            <li>แอปเรียก <code className="rounded bg-slate-200 px-1 text-[12px]">GET /api/trace/&lt;batchId&gt;</code> ของ KLORA แล้วแสดงแหล่งผลิต วันเก็บเกี่ยว อายุ ระยะการสุก CO₂e และใบรับรอง — ข้อมูลชุดเดียวกับที่สแกน QR</li>
          </ol>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            หน้าจอนี้เป็นภาพจำลองเพื่อคุยแนวทางกับทีม Super App / Interface เท่านั้น — ไม่ใช่แอปจริงของไปรษณีย์ไทย ข้อมูลสินค้าในหน้ารายละเอียดดึงจากระบบ KLORA จริง
          </p>
          <p className="text-[13px] text-slate-500">ข้อมูลตัวอย่าง: มะม่วง / คะน้า / กล้วย จากสวนดอยฝาง และกุหลาบจากสวนดอยแม่สลอง</p>
        </aside>
      </main>
    </div>
  );
}
