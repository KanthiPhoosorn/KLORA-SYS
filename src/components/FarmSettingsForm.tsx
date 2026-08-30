"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, MapPin, User } from "lucide-react";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";

function useSaver(id: string, onSaved: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      router.refresh();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, save };
}

function SaveBtn({ busy }: { busy: boolean }) {
  return (
    <button type="submit" disabled={busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] bg-brand-pink px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
      {busy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึกข้อมูล
    </button>
  );
}

export default function FarmSettingsForm({ supplier }: { supplier: Supplier }) {
  const [tab, setTab] = useState<"producer" | "resources">("producer");
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };
  const profile = useSaver(supplier.id, () => showToast("ข้อมูลผู้ผลิตของคุณถูกบันทึกแล้ว"));
  const calc = useSaver(supplier.id, () => showToast("ข้อมูลการใช้ทรัพยากรของคุณถูกบันทึกแล้ว"));

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

  const RESOURCE_FIELDS: { k: keyof typeof c; label: string }[] = [
    { k: "fuelLitres", label: "ปริมาณเชื้อเพลิง (ลิตร/เดือน)" },
    { k: "electricityKwh", label: "ปริมาณไฟฟ้า (กิโลวัตต์/เดือน)" },
    { k: "fertilizerKg", label: "ปริมาณปุ๋ย (กิโลกรัม/เดือน)" },
    { k: "agriChemicalsKg", label: "ปริมาณสารเคมีทางการเกษตร (กิโลกรัม/เดือน)" },
    { k: "waterM3", label: "ปริมาณน้ำ (ลูกบาศก์เมตร/เดือน)" },
    { k: "wasteKg", label: "ปริมาณของเสีย (กิโลกรัม/เดือน)" },
    { k: "flowersPerMonth", label: "จำนวนดอกไม้ที่ปลูกทั้งหมด (ดอก/เดือน)" },
  ];

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
          <div>
            <p className="text-[13px] font-semibold text-slate-800">บันทึกข้อมูลสำเร็จ</p>
            <p className="text-[12px] text-slate-400">{toast}</p>
          </div>
        </div>
      ) : null}

      {/* Farm hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{supplier.farmName}</h2>
            {supplier.highlights && supplier.highlights !== "—" ? (
              <p className="mt-1 max-w-xl text-[13px] text-slate-500">{supplier.highlights}</p>
            ) : null}
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-slate-500">
              <MapPin size={14} className="text-brand-pink" /> {supplier.address}
            </p>
          </div>
          <div className="h-28 w-full shrink-0 rounded-xl bg-gradient-to-br from-emerald-200 via-green-100 to-emerald-50 sm:w-64" style={supplier.photoUrl ? { backgroundImage: `url(${supplier.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-t border-slate-100 px-6">
          {[
            { key: "producer", label: "ข้อมูลผู้ผลิต" },
            { key: "resources", label: "ข้อมูลการใช้ทรัพยากร" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`-mb-px border-b-2 py-3 text-[14px] transition ${tab === t.key ? "border-brand-pink font-semibold text-brand-pink" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Producer info */}
      {tab === "producer" ? (
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
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><User size={15} /></span>
            ข้อมูลผู้ผลิต
          </h3>
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
          {profile.error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{profile.error}</p> : null}
          <SaveBtn busy={profile.busy} />
        </form>
      ) : (
        /* Resource usage */
        <form
          onSubmit={(e) => { e.preventDefault(); calc.save(c); }}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><User size={15} /></span>
            ข้อมูลการใช้ทรัพยากร
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {RESOURCE_FIELDS.map((f) => (
              <div key={f.k}>
                <label className={labelCls}>{f.label}</label>
                <input type="number" min="0" step="any" value={c[f.k]} onChange={sc(f.k)} className={inputCls} />
              </div>
            ))}
          </div>
          <p className="text-[12px] text-slate-400">ตะกร้า (Basket) กรอกในแต่ละรอบส่งออก — ระบบนับการใช้ซ้ำให้เอง · ข้อมูลนี้ใช้คำนวณค่าคาร์บอนเฉพาะของฟาร์มคุณ</p>
          {calc.error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{calc.error}</p> : null}
          <SaveBtn busy={calc.busy} />
        </form>
      )}
    </div>
  );
}
