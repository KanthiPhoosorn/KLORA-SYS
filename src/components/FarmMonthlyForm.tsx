"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { farmMonthlyCarbon, dynamicFlowerEF, FLOWER_EF_DEFAULT } from "@/lib/carbon-kyn";
import type { FarmMonthlyInput } from "@/lib/types";

const inputCls =
  "w-full rounded-[5px] border border-gray-300 bg-white px-[15px] py-[9px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1 block text-[13px] text-slate-700";

const FIELDS = [
  { key: "dieselLitres", label: "น้ำมันดีเซล", unit: "ลิตร/เดือน" },
  { key: "electricityKwh", label: "ไฟฟ้า", unit: "kWh/เดือน" },
  { key: "fertilizerKg", label: "ปุ๋ยเคมี", unit: "kg/เดือน" },
  { key: "agrochemicalKg", label: "สารเคมีเกษตร", unit: "kg/เดือน" },
  { key: "waterM3", label: "น้ำ", unit: "ลบ.ม./เดือน" },
  { key: "organicWasteKg", label: "ของเสียอินทรีย์", unit: "kg/เดือน" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export default function FarmMonthlyForm({
  latest,
  history,
}: {
  latest: FarmMonthlyInput | null;
  history: FarmMonthlyInput[];
}) {
  const router = useRouter();
  const [month, setMonth] = useState(latest?.reportingMonth ?? new Date().toISOString().slice(0, 7));
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of FIELDS) seed[f.key] = latest?.[f.key as FieldKey]?.toString() ?? "";
    seed.totalFlowerYieldKg = latest?.totalFlowerYieldKg?.toString() ?? "";
    return seed;
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeric = (k: string) => {
    const v = Number(vals[k]);
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };

  // Live preview of the farm's own carbon intensity, using the same engine as the backend.
  const preview = {
    dieselLitres: numeric("dieselLitres"),
    electricityKwh: numeric("electricityKwh"),
    fertilizerKg: numeric("fertilizerKg"),
    agrochemicalKg: numeric("agrochemicalKg"),
    waterM3: numeric("waterM3"),
    organicWasteKg: numeric("organicWasteKg"),
    totalFlowerYieldKg: numeric("totalFlowerYieldKg"),
  };
  const monthCarbon = farmMonthlyCarbon(preview);
  const ef = dynamicFlowerEF(preview);
  const usingFallback = !preview.totalFlowerYieldKg;

  async function save() {
    setError(null);
    setSaved(false);
    if (!/^\d{4}-\d{2}$/.test(month)) return setError("ระบุเดือนให้ถูกต้อง");
    setBusy(true);
    try {
      const res = await fetch("/api/farm-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingMonth: month, ...preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelCls}>เดือนที่รายงาน</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
        </div>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className={labelCls}>
              {f.label} <span className="text-slate-400">({f.unit})</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={vals[f.key]}
              onChange={(e) => setVals((s) => ({ ...s, [f.key]: e.target.value }))}
              placeholder="0"
              className={inputCls}
            />
          </div>
        ))}
        <div>
          <label className={labelCls}>
            ผลผลิตดอกไม้ทั้งเดือน <span className="text-[#ee443f]">*</span>{" "}
            <span className="text-slate-400">(kg)</span>
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={vals.totalFlowerYieldKg}
            onChange={(e) => setVals((s) => ({ ...s, totalFlowerYieldKg: e.target.value }))}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      {/* Live Dynamic_Flower_EF preview */}
      <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="text-slate-500">
            คาร์บอนรวมของเดือนนี้ <span className="font-semibold text-slate-800">{monthCarbon.toFixed(1)}</span> kg CO₂e
          </span>
          <span className="text-slate-500">
            ค่าคาร์บอนต่อ 1 kg ดอกไม้{" "}
            <span className="font-semibold text-brand-pink">{ef.toFixed(4)}</span> kg CO₂e/kg
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {usingFallback
            ? `ยังไม่ได้กรอกผลผลิต — ระบบจะใช้ค่ากลาง ${FLOWER_EF_DEFAULT} kg CO₂e/kg ไปก่อน`
            : "คำนวณจากข้อมูลจริงของฟาร์มคุณ (Dynamic Flower EF) แทนค่ากลางของระบบ"}
        </p>
      </div>

      {error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex h-[38px] items-center gap-2 rounded-[5px] bg-brand-pink px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึกข้อมูลเดือนนี้
        </button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600">
            <Check size={15} /> บันทึกแล้ว
          </span>
        ) : null}
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto rounded-[8px] border border-slate-200">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">เดือน</th>
                <th className="px-4 py-2 text-right font-medium">ผลผลิต (kg)</th>
                <th className="px-4 py-2 text-right font-medium">คาร์บอนรวม (kg CO₂e)</th>
                <th className="px-4 py-2 text-right font-medium">EF (kg CO₂e/kg)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2 text-slate-700">{r.reportingMonth}</td>
                  <td className="px-4 py-2 text-right tabular">{r.totalFlowerYieldKg?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular">{farmMonthlyCarbon(r).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right tabular font-medium text-slate-800">
                    {dynamicFlowerEF(r).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
