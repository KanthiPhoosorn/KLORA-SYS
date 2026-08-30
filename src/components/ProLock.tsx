import { Lock, TrendingUp, Leaf } from "lucide-react";

// Freemium paywall (Figma "Lock / Pro" state): a centred card floating over a blurred,
// faded preview of the gated dashboard. Used on ภาพรวม and แดชบอร์ดคาร์บอน for free-plan farms.
export default function ProLock({
  title = "ปลดล็อกแดชบอร์ดคาร์บอน",
  desc = "อัปเกรดเพื่อดูภาพรวมการปล่อย CO₂e วิเคราะห์แนวโน้ม และติดตามผลการลดคาร์บอนของฟาร์มได้ในที่เดียว",
}: {
  title?: string;
  desc?: string;
}) {
  return (
    <div className="relative min-h-[560px]">
      {/* Blurred faux-dashboard behind the card */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none space-y-4 opacity-50 blur-[6px]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="mt-4 h-6 w-24 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex h-full items-end gap-3">
              {[40, 70, 55, 85, 60, 95].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-emerald-200" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="h-56 rounded-2xl border border-slate-100 bg-white shadow-sm" />
        </div>
      </div>

      {/* Centre card */}
      <div className="relative flex min-h-[560px] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-white px-8 py-10 text-center shadow-xl ring-1 ring-slate-100">
          <span className="inline-block rounded-full bg-brand-pink-light px-4 py-1.5 text-xs font-medium text-brand-pink">
            ฟีเจอร์สำหรับสมาชิก
          </span>

          <div className="relative mx-auto my-6 grid h-40 w-56 place-items-center rounded-2xl bg-gradient-to-br from-brand-pink-light via-white to-emerald-50">
            <div className="grid h-24 w-36 place-items-center rounded-xl bg-white shadow-sm">
              <TrendingUp size={40} className="text-emerald-500" />
            </div>
            <span className="absolute left-5 top-6 grid h-9 w-9 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-pink shadow-sm">
              CO₂
            </span>
            <span className="absolute bottom-6 right-8 grid h-10 w-10 place-items-center rounded-full bg-brand-pink text-white shadow">
              <Lock size={18} />
            </span>
            <Leaf size={22} className="absolute right-4 top-8 text-emerald-400" />
            <Leaf size={18} className="absolute bottom-8 left-8 text-emerald-300" />
          </div>

          <h1 className="text-2xl font-bold text-brand-pink">{title}</h1>
          <p className="mt-1.5 text-sm font-semibold text-emerald-600">ฟีเจอร์นี้รวมอยู่ในแพ็กเกจ Pro</p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">{desc}</p>
          <button className="mt-7 w-full rounded-[10px] bg-brand-pink px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
            ดูแพ็กเกจและอัปเกรด
          </button>
        </div>
      </div>
    </div>
  );
}
