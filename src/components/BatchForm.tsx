"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-pink-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20";
const labelCls = "block text-sm font-medium text-pink-900/80";

export default function BatchForm({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = { supplierId, ...Object.fromEntries(fd.entries()) };
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className={labelCls}>จำนวนดอกไม้ (ในตะกร้า)</span>
          <input
            name="flowerCount"
            type="number"
            min="1"
            required
            placeholder="500"
            className={inputCls}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>วันที่ตัด</span>
          <input name="cutDate" type="date" required className={inputCls} />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>ระยะทางปลายทาง (km)</span>
          <input
            name="distanceKm"
            type="number"
            min="0"
            step="any"
            required
            placeholder="785"
            className={inputCls}
          />
        </label>
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Plus size={16} />
        )}
        คำนวณคาร์บอน + บันทึกรอบการตัด
      </button>
    </form>
  );
}
