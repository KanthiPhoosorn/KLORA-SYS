"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-pink-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20";
const labelCls = "block text-sm font-medium text-pink-900/80";

function Field({
  name,
  label,
  required,
  type = "text",
  placeholder,
  step,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="space-y-1">
      <span className={labelCls}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  );
}

export default function SupplierForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Supplier | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setCreated(data as Supplier);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4 px-5 py-6 text-center">
        <CheckCircle2 className="mx-auto text-pink-600" size={40} />
        <div>
          <p className="text-sm text-pink-900/60">ระบบสร้าง SUP ID สำเร็จ</p>
          <p className="mt-1 text-2xl font-bold tabular text-pink-800">
            {created.id}
          </p>
          <p className="mt-1 text-sm text-pink-900/70">
            {created.farmName}
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Link
            href={`/farm/${created.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-300 px-4 py-2 text-sm font-medium text-pink-900 hover:bg-pink-400"
          >
            เปิดหน้าฟาร์ม + ลงรอบการตัด <ArrowRight size={16} />
          </Link>
          <button
            onClick={() => setCreated(null)}
            className="rounded-xl border border-pink-900/15 bg-white px-4 py-2 text-sm font-medium text-pink-900 hover:bg-pink-50"
          >
            ลงทะเบียนฟาร์มใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 px-5 py-5">
      <div>
        <h3 className="text-sm font-semibold text-pink-900">
          ข้อมูลพื้นฐานบังคับ
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field name="farmName" label="ชื่อฟาร์ม" required placeholder="เช่น สวนกุหลาบดอยแม่สลอง" />
          <Field name="owner" label="เจ้าของฟาร์ม" required placeholder="ชื่อ-นามสกุล" />
          <label className="space-y-1 sm:col-span-2">
            <span className={labelCls}>
              ที่อยู่<span className="text-red-500"> *</span>
            </span>
            <input name="address" required placeholder="ตำบล อำเภอ จังหวัด" className={inputCls} />
          </label>
          <Field name="gpsLat" label="พิกัด GPS (lat)" type="number" step="any" placeholder="20.1597" />
          <Field name="gpsLng" label="พิกัด GPS (lng)" type="number" step="any" placeholder="99.6361" />
          <Field name="flowerType" label="ประเภทดอกไม้" required placeholder="เช่น กุหลาบ / เบญจมาศ" />
          <Field name="contact" label="ช่องทางติดต่อ" required placeholder="โทร / LINE" />
          <label className="space-y-1 sm:col-span-2">
            <span className={labelCls}>
              จุดเด่นฟาร์ม<span className="text-red-500"> *</span>
            </span>
            <textarea name="highlights" required rows={2} placeholder="เช่น ปลูกบนดอยสูง ลดการใช้สารเคมี" className={inputCls} />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-pink-900">
          ข้อมูลใช้คำนวณคาร์บอน <span className="font-normal text-pink-900/50">(ไม่บังคับ — ตั้งค่าครั้งเดียว)</span>
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field name="fuelLitres" label="Fuel (ลิตร/รอบ)" type="number" step="any" placeholder="15" />
          <Field name="electricityKwh" label="Electricity (kWh/รอบ)" type="number" step="any" placeholder="40" />
          <Field name="fertilizerKg" label="Fertilizer (kg/รอบ)" type="number" step="any" placeholder="20" />
          <Field name="basketId" label="Basket ID" placeholder="BSK-001" />
          <Field name="reuseCycles" label="Reuse Cycle (รอบ/ตะกร้า)" type="number" step="any" placeholder="10" />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-pink-300 px-5 py-2.5 text-sm font-semibold text-pink-900 transition hover:bg-pink-400 disabled:opacity-60"
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : null}
        ระบบสร้าง SUP ID
      </button>
    </form>
  );
}
