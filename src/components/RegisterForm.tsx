"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MapPin, ArrowRight } from "lucide-react";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const labelCls = "text-sm font-medium text-slate-600";

function Field({
  name,
  label,
  required,
  type = "text",
  placeholder,
  step,
  full,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  step?: string;
  full?: boolean;
}) {
  return (
    <label className={`block space-y-1 ${full ? "sm:col-span-2" : ""}`}>
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

export default function RegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState("");

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setGps(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const [latRaw, lngRaw] = gps.split(",").map((s) => s.trim());
    const body = {
      farmName: fd.get("farmName"),
      owner: fd.get("owner"),
      address: fd.get("address"),
      gpsLat: latRaw ? Number(latRaw) : 0,
      gpsLng: lngRaw ? Number(lngRaw) : 0,
      flowerType: fd.get("flowerType"),
      contact: fd.get("contact"),
      highlights: fd.get("highlights"),
      fuelLitres: fd.get("fuelLitres") || undefined,
      electricityKwh: fd.get("electricityKwh") || undefined,
      fertilizerKg: fd.get("fertilizerKg") || undefined,
      email: fd.get("email"),
      username: fd.get("username"),
      password: fd.get("password"),
      confirmPassword: fd.get("confirmPassword"),
    };
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สมัครไม่สำเร็จ");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
    >
      <div className="text-center">
        <div className="text-sm font-medium text-slate-400">ต้นน้ำ · SUP</div>
        <h1 className="mt-1 text-2xl font-bold text-blue-600">สมัครสมาชิก</h1>
      </div>

      {/* Mandatory profile */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">ข้อมูลพื้นฐาน (บังคับ)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="farmName" label="ชื่อฟาร์ม" required placeholder="สวนดอกไม้เชียงราย" />
          <Field name="owner" label="เจ้าของฟาร์ม" required placeholder="นายสมชาย" />
          <Field name="address" label="ที่อยู่" required full placeholder="ต.รอบเวียง อ.เมือง จ.เชียงราย" />
          <label className="block space-y-1 sm:col-span-2">
            <span className={labelCls}>พิกัด GPS</span>
            <div className="flex gap-2">
              <input
                value={gps}
                onChange={(e) => setGps(e.target.value)}
                placeholder="19.9105, 99.8406"
                className={inputCls}
              />
              <button
                type="button"
                onClick={useCurrentLocation}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <MapPin size={15} /> ตำแหน่งปัจจุบัน
              </button>
            </div>
          </label>
          <Field name="flowerType" label="ประเภทดอกไม้" required placeholder="กุหลาบ, เบญจมาศ" />
          <Field name="contact" label="ช่องทางติดต่อ" required placeholder="เบอร์โทร / Line" />
          <label className="block space-y-1 sm:col-span-2">
            <span className={labelCls}>
              จุดเด่นฟาร์ม<span className="text-red-500"> *</span>
            </span>
            <textarea
              name="highlights"
              required
              rows={2}
              placeholder="ปลูกแบบออร์แกนิก ไม่ใช้สารเคมี"
              className={inputCls}
            />
          </label>
        </div>
      </section>

      {/* Optional calc inputs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          ข้อมูลใช้คำนวณ (ไม่บังคับ){" "}
          <span className="font-normal text-slate-400">ข้ามได้ แก้ไขทีหลังได้</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="fuelLitres" label="Fuel (ลิตร/เดือน)" type="number" step="any" placeholder="18" />
          <Field name="electricityKwh" label="Electricity (kWh)" type="number" step="any" placeholder="120" />
          <Field name="fertilizerKg" label="Fertilizer (กก.)" type="number" step="any" placeholder="25" />
        </div>
        <p className="text-xs text-slate-400">
          ตะกร้า (Basket) กรอกตอนลงรอบส่งออกแต่ละครั้ง เพิ่มได้หลายใบ
        </p>
      </section>

      {/* Account */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-blue-600">บัญชีผู้ใช้</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="email" label="อีเมล" type="email" required full placeholder="farm@email.com" />
          <Field name="username" label="ชื่อผู้ใช้" required placeholder="username" />
          <Field name="password" label="รหัสผ่าน (≥ 8 ตัว)" type="password" required placeholder="••••••••" />
          <Field name="confirmPassword" label="ยืนยันรหัสผ่าน" type="password" required full placeholder="••••••••" />
        </div>
      </section>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        สมัครสมาชิก · รับ SUP ID <ArrowRight size={16} />
      </button>
      <p className="text-center text-xs text-slate-400">
        ระบบจะส่งอีเมลยืนยันไปยังอีเมลที่กรอกไว้ ·{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
