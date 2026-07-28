import Link from "next/link";
import { Sprout, Factory, Package, ArrowRight } from "lucide-react";

const LANES = [
  {
    href: "/login",
    icon: Sprout,
    tag: "ต้นน้ำ · SUP",
    title: "ฟาร์ม / Supplier",
    desc: "สมัครสมาชิก → กรอกข้อมูลฟาร์ม → รับ SUP ID → ลงรอบส่งออกทุกครั้ง",
    cta: "เข้าสู่ระบบฟาร์ม",
  },
  {
    href: "/kyn",
    icon: Factory,
    tag: "กลางน้ำ · KYN",
    title: "ระบบคำนวณคาร์บอน",
    desc: "รับข้อมูล → คัดแยก → คำนวณ CO₂e + อายุดอกไม้ → รายงานสรุป",
    cta: "เปิดคอนโซล KYN",
  },
  {
    href: "/thaipost",
    icon: Package,
    tag: "ปลายน้ำ · Thai Post",
    title: "ออกฉลาก & QR",
    desc: "ค้นหา SUP ID → สร้าง QR Label → พิมพ์ติดพัสดุ",
    cta: "เปิดคอนโซล Thai Post",
  },
];

export default function Landing() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-12">
      <header className="mb-8">
        <div className="text-3xl font-extrabold tracking-tight text-pink-500">KLORA</div>
        <p className="mt-1 text-sm text-slate-500">
          ระบบปฏิบัติการการขนส่งดอกไม้ · เลือกบทบาทเพื่อเข้าใช้งาน
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {LANES.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Icon size={20} />
              </span>
              <div className="mt-4 text-xs font-medium text-slate-400">{l.tag}</div>
              <div className="mt-0.5 text-lg font-bold text-slate-900">{l.title}</div>
              <p className="mt-2 text-sm text-slate-500">{l.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:gap-2.5">
                {l.cta} <ArrowRight size={15} />
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        บัญชีทดลอง (ฟาร์ม): <b>farm</b> / <b>password123</b>
      </p>
    </div>
  );
}
