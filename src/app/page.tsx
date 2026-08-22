import Link from "next/link";
import { Sprout, Boxes, Factory, ArrowRight, Flower2 } from "lucide-react";

const PORTALS = [
  {
    tag: "ต้นน้ำ · Supplier",
    title: "ฟาร์ม / ผู้ผลิต",
    desc: "ลงรอบส่งออก ดูแดชบอร์ดคาร์บอน และติดตามสถานะ",
    icon: Sprout,
    color: "from-emerald-400 to-emerald-600",
    demo: "farm / password123",
  },
  {
    tag: "กลางน้ำ · KYN",
    title: "KYN × Outsource",
    desc: "คำนวณคาร์บอน จัดการ SUP และรายงานสรุป",
    icon: Factory,
    color: "from-slate-700 to-slate-900",
    demo: "kyn / password123",
  },
  {
    tag: "ปลายน้ำ · Logistic",
    title: "โรงคัดแยก / ขนส่ง",
    desc: "ค้นหาพัสดุ พิมพ์ QR label และติดตามการพิมพ์",
    icon: Boxes,
    color: "from-blue-500 to-blue-700",
    demo: "logistic / password123",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="brand-bg border-b border-pink-900/10">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm font-medium text-pink-600">
            <Flower2 size={15} /> ระบบตรวจสอบที่มา &amp; คาร์บอนของดอกไม้
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-pink-600">KLORA</h1>
          <p className="mt-2 max-w-2xl text-lg font-semibold text-pink-700">
            ระบบปฏิบัติการการขนส่งดอกไม้ — เลือกพอร์ทัลตามบทบาทเพื่อเข้าใช้งาน
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {PORTALS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.title}
                href="/login"
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${p.color} text-white`}>
                  <Icon size={22} />
                </span>
                <div className="mt-4 text-xs font-medium text-slate-400">{p.tag}</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900">{p.title}</div>
                <p className="mt-2 text-sm text-slate-500">{p.desc}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">{p.demo}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:gap-2">
                    เข้าสู่ระบบ <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">
          ฟาร์มใหม่สามารถ <Link href="/register" className="font-medium text-pink-600 hover:underline">สมัครสมาชิก</Link> เพื่อรับ SUP ID
        </p>
      </section>
    </div>
  );
}
