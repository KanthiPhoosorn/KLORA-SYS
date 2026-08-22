"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[9px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1 block text-[14px] text-black";

function useSaver(id: string, onDone?: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(patch: Record<string, unknown>) {
    setBusy(true); setError(null); setDone(false);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setDone(true); router.refresh(); onDone?.();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return { busy, done, error, save };
}

function SaveBtn({ busy, done }: { busy: boolean; done: boolean }) {
  return (
    <button type="submit" disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[5px] bg-brand-pink px-6 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
      {busy ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={16} /> : null}
      {done ? "บันทึกแล้ว" : "บันทึกการแก้ไข"}
    </button>
  );
}

export default function FarmSettingsForm({ supplier, onDone }: { supplier: Supplier; onDone?: () => void }) {
  const profile = useSaver(supplier.id, onDone);
  const calc = useSaver(supplier.id, onDone);

  const [p, setP] = useState({
    farmName: supplier.farmName ?? "",
    contactName: supplier.contactName ?? supplier.owner ?? "",
    phone: supplier.phone ?? "",
    lineId: supplier.lineId ?? "",
    address: supplier.address ?? "",
    gps: supplier.gpsLat || supplier.gpsLng ? `${supplier.gpsLat}, ${supplier.gpsLng}` : "",
    flowerType: supplier.flowerType ?? "",
    highlights: supplier.highlights ?? "",
  });
  const [c, setC] = useState({
    fuelLitres: supplier.fuelLitres?.toString() ?? "",
    electricityKwh: supplier.electricityKwh?.toString() ?? "",
    fertilizerKg: supplier.fertilizerKg?.toString() ?? "",
    agriChemicalsKg: supplier.agriChemicalsKg?.toString() ?? "",
    waterM3: supplier.waterM3?.toString() ?? "",
    wasteKg: supplier.wasteKg?.toString() ?? "",
    flowersPerMonth: supplier.flowersPerMonth?.toString() ?? "",
  });
  const sp = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });
  const sc = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value });

  return (
    <div className="space-y-6">
      {/* Producer info */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const [la, ln] = p.gps.split(",").map((x) => x.trim());
          profile.save({
            farmName: p.farmName, contactName: p.contactName, owner: p.contactName, phone: p.phone,
            lineId: p.lineId, address: p.address, gpsLat: la ? Number(la) : undefined, gpsLng: ln ? Number(ln) : undefined,
            flowerType: p.flowerType, highlights: p.highlights,
            contact: [p.phone && `โทร ${p.phone}`, p.lineId && `LINE ${p.lineId}`].filter(Boolean).join(" / "),
          });
        }}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-[16px] font-semibold text-slate-900">ข้อมูลผู้ผลิต</h2>
        <div><label className={labelCls}>ชื่อผู้ใช้ (แหล่งผลิต)</label><input value={p.farmName} onChange={sp("farmName")} className={inputCls} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>ชื่อผู้ติดต่อ</label><input value={p.contactName} onChange={sp("contactName")} className={inputCls} /></div>
          <div><label className={labelCls}>เบอร์โทร</label><input value={p.phone} onChange={sp("phone")} className={inputCls} /></div>
          <div><label className={labelCls}>Line ID</label><input value={p.lineId} onChange={sp("lineId")} className={inputCls} /></div>
          <div><label className={labelCls}>พิกัด GPS</label><input value={p.gps} onChange={sp("gps")} placeholder="12.2222, 13.3333" className={inputCls} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>ที่อยู่</label><input value={p.address} onChange={sp("address")} className={inputCls} /></div>
          <div><label className={labelCls}>ชนิดดอกไม้</label><input value={p.flowerType} onChange={sp("flowerType")} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>รายละเอียดเพิ่มเติม</label><textarea value={p.highlights} onChange={sp("highlights")} rows={2} className={inputCls} /></div>
        {profile.error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{profile.error}</p> : null}
        <SaveBtn busy={profile.busy} done={profile.done} />
      </form>

      {/* Resource usage */}
      <form
        onSubmit={(e) => { e.preventDefault(); calc.save(c); }}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-[16px] font-semibold text-slate-900">ข้อมูลการใช้ทรัพยากร</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>ปริมาณเชื้อเพลิง (ลิตร/เดือน)</label><input type="number" value={c.fuelLitres} onChange={sc("fuelLitres")} className={inputCls} /></div>
          <div><label className={labelCls}>ปริมาณไฟฟ้า (กิโลวัตต์/เดือน)</label><input type="number" value={c.electricityKwh} onChange={sc("electricityKwh")} className={inputCls} /></div>
          <div><label className={labelCls}>ปริมาณปุ๋ย (กิโลกรัม/เดือน)</label><input type="number" value={c.fertilizerKg} onChange={sc("fertilizerKg")} className={inputCls} /></div>
          <div><label className={labelCls}>ปริมาณสารเคมีทางการเกษตร (กก./เดือน)</label><input type="number" value={c.agriChemicalsKg} onChange={sc("agriChemicalsKg")} className={inputCls} /></div>
          <div><label className={labelCls}>ปริมาณน้ำ (ลบ.ม./เดือน)</label><input type="number" value={c.waterM3} onChange={sc("waterM3")} className={inputCls} /></div>
          <div><label className={labelCls}>ปริมาณของเสีย (กิโลกรัม/เดือน)</label><input type="number" value={c.wasteKg} onChange={sc("wasteKg")} className={inputCls} /></div>
          <div><label className={labelCls}>จำนวนดอกที่ปลูกต่อเดือน (ดอก)</label><input type="number" value={c.flowersPerMonth} onChange={sc("flowersPerMonth")} className={inputCls} /></div>
        </div>
        <p className="text-[12px] text-slate-400">ตะกร้า (Basket) กรอกในแต่ละรอบส่งออก — ระบบนับการใช้ซ้ำให้เอง</p>
        {calc.error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{calc.error}</p> : null}
        <SaveBtn busy={calc.busy} done={calc.done} />
      </form>
    </div>
  );
}
