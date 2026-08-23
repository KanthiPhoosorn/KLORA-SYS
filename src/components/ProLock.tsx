import { Lock, TrendingUp, Leaf } from "lucide-react";

// Freemium paywall shown on Pro-only features (e.g. the carbon dashboard) for free-plan farms.
export default function ProLock() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="relative mx-auto mb-6 grid h-40 w-52 place-items-center rounded-2xl bg-gradient-to-br from-brand-pink-light to-emerald-50">
        <div className="grid h-24 w-32 place-items-center rounded-xl bg-white shadow-sm">
          <TrendingUp size={40} className="text-emerald-500" />
        </div>
        <span className="absolute right-6 top-6 grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">CO₂</span>
        <span className="absolute bottom-6 right-8 grid h-10 w-10 place-items-center rounded-full bg-brand-pink text-white">
          <Lock size={18} />
        </span>
        <Leaf size={22} className="absolute left-6 top-8 text-emerald-400" />
      </div>

      <span className="inline-block rounded-full bg-brand-pink-light px-3 py-1 text-xs font-medium text-brand-pink">ฟีเจอร์สำหรับสมาชิก</span>
      <h1 className="mt-4 text-2xl font-bold text-brand-pink">ปลดล็อกแดชบอร์ดคาร์บอน</h1>
      <p className="mt-1 text-sm font-semibold text-emerald-600">ฟีเจอร์นี้รวมอยู่ในแพ็กเกจ Pro</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500">
        อัปเกรดเพื่อดูภาพรวมการปล่อย CO₂e วิเคราะห์แนวโน้ม และติดตามผลการลดคาร์บอนของฟาร์มได้ในที่เดียว
      </p>
      <button className="mt-6 w-full max-w-xs rounded-[8px] bg-brand-pink px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
        ดูแพ็กเกจและอัปเกรด
      </button>
    </div>
  );
}
