"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const labelCls = "text-sm font-medium text-slate-600";

function useSaver(id: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, done, error, save };
}

function SaveButton({ busy, done }: { busy: boolean; done: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={16} /> : null}
      {done ? "บันทึกแล้ว" : "บันทึกการแก้ไข"}
    </button>
  );
}

export default function FarmSettingsForm({ supplier }: { supplier: Supplier }) {
  const profile = useSaver(supplier.id);
  const calc = useSaver(supplier.id);

  const [farmName, setFarmName] = useState(supplier.farmName);
  const [address, setAddress] = useState(supplier.address);
  const [flowerType, setFlowerType] = useState(supplier.flowerType);
  const [contact, setContact] = useState(supplier.contact);

  const [fuelLitres, setFuel] = useState(supplier.fuelLitres?.toString() ?? "");
  const [electricityKwh, setElec] = useState(supplier.electricityKwh?.toString() ?? "");
  const [fertilizerKg, setFert] = useState(supplier.fertilizerKg?.toString() ?? "");
  const [basketId, setBasket] = useState(supplier.basketId ?? "");
  const [reuseCycles, setReuse] = useState(supplier.reuseCycles?.toString() ?? "");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Farm profile */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          profile.save({ farmName, address, flowerType, contact });
        }}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-bold text-slate-900">ข้อมูลฟาร์ม</h2>
        <label className="block space-y-1">
          <span className={labelCls}>ชื่อฟาร์ม</span>
          <input value={farmName} onChange={(e) => setFarmName(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>ที่อยู่</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>ประเภทดอกไม้</span>
          <input value={flowerType} onChange={(e) => setFlowerType(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>ช่องทางติดต่อ</span>
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} />
        </label>
        {profile.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{profile.error}</p>
        ) : null}
        <SaveButton busy={profile.busy} done={profile.done} />
      </form>

      {/* Calc settings */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calc.save({ fuelLitres, electricityKwh, fertilizerKg, basketId, reuseCycles });
        }}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-bold text-slate-900">ตั้งค่าข้อมูลคำนวณ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={labelCls}>Fuel (ลิตร/เดือน)</span>
            <input type="number" step="any" value={fuelLitres} onChange={(e) => setFuel(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>Electricity (kWh)</span>
            <input type="number" step="any" value={electricityKwh} onChange={(e) => setElec(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>Fertilizer (กก.)</span>
            <input type="number" step="any" value={fertilizerKg} onChange={(e) => setFert(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>Basket ID</span>
            <input value={basketId} onChange={(e) => setBasket(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className={labelCls}>Reuse Cycle (รอบการใช้ซ้ำตะกร้า)</span>
            <input type="number" step="any" value={reuseCycles} onChange={(e) => setReuse(e.target.value)} className={inputCls} />
          </label>
        </div>
        {calc.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{calc.error}</p>
        ) : null}
        <SaveButton busy={calc.busy} done={calc.done} />
      </form>
    </div>
  );
}
