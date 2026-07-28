"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Send } from "lucide-react";
import { DESTINATIONS, estimateDistanceKm } from "@/lib/geo";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const labelCls = "text-sm font-medium text-slate-600";

export default function RoundForm({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"submit" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [distanceEdited, setDistanceEdited] = useState(false);

  const [flowerCount, setFlowerCount] = useState("");
  const [cutDate, setCutDate] = useState("");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [basketId, setBasketId] = useState(supplier.basketId ?? "");

  // When the destination changes, auto-fill the distance (unless manually edited).
  function onDestination(value: string) {
    setDestination(value);
    if (!distanceEdited) {
      const est = estimateDistanceKm(value, { lat: supplier.gpsLat, lng: supplier.gpsLng });
      if (est != null) setDistanceKm(String(est));
    }
  }

  async function save(status: "submitted" | "draft") {
    setBusy(status === "draft" ? "draft" : "submit");
    setError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowerCount: Number(flowerCount) || 0,
          cutDate,
          destination,
          distanceKm: Number(distanceKm) || 0,
          basketId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      router.push("/app/history");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cutDate) return setError("กรุณาระบุวันที่ตัด");
    save("submitted");
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={labelCls}>จำนวนดอกไม้ (ก้าน)</span>
          <input
            type="number"
            value={flowerCount}
            onChange={(e) => setFlowerCount(e.target.value)}
            placeholder="500"
            className={inputCls}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className={labelCls}>วันที่ตัด</span>
          <input
            type="date"
            value={cutDate}
            onChange={(e) => setCutDate(e.target.value)}
            className={inputCls}
            required
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className={labelCls}>ปลายทาง</span>
        <input
          list="destinations"
          value={destination}
          onChange={(e) => onDestination(e.target.value)}
          placeholder="กรุงเทพฯ"
          className={inputCls}
        />
        <datalist id="destinations">
          {DESTINATIONS.map((d) => (
            <option key={d.name} value={d.name} />
          ))}
        </datalist>
      </label>

      <label className="block space-y-1">
        <span className={labelCls}>ระยะทาง (กม.) — ประมาณการอัตโนมัติ</span>
        <input
          type="number"
          value={distanceKm}
          onChange={(e) => {
            setDistanceKm(e.target.value);
            setDistanceEdited(true);
          }}
          placeholder="640"
          className={inputCls}
        />
      </label>

      <label className="block space-y-1">
        <span className={labelCls}>ตะกร้าที่ใช้ (Basket ID)</span>
        <input
          value={basketId}
          onChange={(e) => setBasketId(e.target.value)}
          placeholder="BSK-014"
          className={inputCls}
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {busy === "submit" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          บันทึกและส่งข้อมูล
        </button>
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "draft" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          บันทึกร่าง
        </button>
      </div>

      <p className="text-xs text-slate-400">
        ข้อมูลจะถูกส่งไปที่ระบบ KYN ทันทีเพื่อคำนวณคาร์บอนฟุตพรินท์
      </p>
    </form>
  );
}
