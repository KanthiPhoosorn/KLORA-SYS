"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Send, Plus, X } from "lucide-react";
import { DESTINATIONS, estimateDistanceKm } from "@/lib/geo";
import type { Supplier } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const labelCls = "text-sm font-medium text-slate-600";

const COMMON_VARIETIES = [
  "Red Naomi",
  "Freedom",
  "Avalanche",
  "Mondial",
  "Anastasia White",
  "Zembla",
  "Lily Oriental",
  "Carnation",
];

export default function RoundForm({
  supplier,
  varietyOptions = [],
  basketOptions = [],
  onDone,
}: {
  supplier: Supplier;
  varietyOptions?: string[];
  basketOptions?: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"submit" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [distanceEdited, setDistanceEdited] = useState(false);

  const [flowerCount, setFlowerCount] = useState("");
  const [variety, setVariety] = useState("");
  const [cutDate, setCutDate] = useState("");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState("");

  // Multiple baskets per round.
  const [baskets, setBaskets] = useState<string[]>([]);
  const [basketDraft, setBasketDraft] = useState("");

  const varieties = Array.from(new Set([...varietyOptions, ...COMMON_VARIETIES]));

  function onDestination(value: string) {
    setDestination(value);
    if (!distanceEdited) {
      const est = estimateDistanceKm(value, { lat: supplier.gpsLat, lng: supplier.gpsLng });
      if (est != null) setDistanceKm(String(est));
    }
  }

  function addBasket() {
    const id = basketDraft.trim();
    if (id && !baskets.includes(id)) setBaskets([...baskets, id]);
    setBasketDraft("");
  }

  async function save(status: "submitted" | "draft") {
    if (status === "submitted" && !cutDate) return setError("กรุณาระบุวันที่ตัด");
    if (status === "submitted" && baskets.length === 0)
      return setError("กรุณาเพิ่มตะกร้าอย่างน้อย 1 ใบ");
    setBusy(status === "draft" ? "draft" : "submit");
    setError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowerCount: Number(flowerCount) || 0,
          variety,
          cutDate,
          destination,
          distanceKm: Number(distanceKm) || 0,
          basketIds: baskets,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      router.refresh();
      if (onDone) onDone();
      else router.push("/app/history");
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save("submitted");
      }}
      className="space-y-4"
    >
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
        <span className={labelCls}>พันธุ์ดอกไม้ (variety)</span>
        <input
          list="varieties"
          value={variety}
          onChange={(e) => setVariety(e.target.value)}
          placeholder="เลือกหรือพิมพ์ เช่น Red Naomi"
          className={inputCls}
        />
        <datalist id="varieties">
          {varieties.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <span className={labelCls}>ระยะทาง (กม.) — ประมาณอัตโนมัติ</span>
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
      </div>

      {/* Multi-basket */}
      <div className="space-y-1.5">
        <span className={labelCls}>ตะกร้าที่ใช้ (Basket ID) — เพิ่มได้หลายใบ</span>
        <div className="flex gap-2">
          <input
            list="baskets"
            value={basketDraft}
            onChange={(e) => setBasketDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBasket();
              }
            }}
            placeholder="BSK-014"
            className={inputCls}
          />
          <datalist id="baskets">
            {basketOptions.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={addBasket}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Plus size={15} /> เพิ่ม
          </button>
        </div>
        {baskets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {baskets.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {b}
                <button type="button" onClick={() => setBaskets(baskets.filter((x) => x !== b))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            ระบบจะนับจำนวนการใช้ซ้ำของแต่ละตะกร้าให้เองเพื่อคิดคาร์บอน
          </p>
        )}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex gap-3 pt-1">
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
