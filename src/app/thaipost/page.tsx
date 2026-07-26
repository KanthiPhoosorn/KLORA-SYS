"use client";

import { useState } from "react";
import { Package, Search, Loader2, Printer } from "lucide-react";
import QrLabel from "@/components/QrLabel";
import type { Supplier, Batch } from "@/lib/types";

export default function ThaiPostPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [printBatch, setPrintBatch] = useState<Batch | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const traceUrl = (id: string) => `${origin}/trace/${id}`;

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const id = query.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError(null);
    setSupplier(null);
    setBatches([]);
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่พบข้อมูล");
      setSupplier(data.supplier);
      setBatches(data.batches);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function print(b: Batch) {
    setPrintBatch(b);
    // Let the print-only DOM update before opening the dialog.
    setTimeout(() => window.print(), 50);
  }

  return (
    <>
      <div className="no-print space-y-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-pink-700">
            <Package className="text-pink-600" /> ปลายน้ำ · Thai Post
          </h1>
          <p className="mt-1 text-pink-900/60">
            ค้นหา SUP ID → สร้าง QR Label → พิมพ์ QR ติดพัสดุ
          </p>
        </div>

        <form
          onSubmit={onSearch}
          className="flex gap-2 rounded-2xl border border-pink-900/10 bg-white/80 p-2 shadow-sm"
        >
          <div className="flex flex-1 items-center gap-2 px-3">
            <Search size={18} className="text-pink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาด้วย SUP ID เช่น SUP-2026-0001"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-2 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            ค้นหา
          </button>
        </form>

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {supplier ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-pink-900/10 bg-white/70 px-5 py-3">
              <div className="font-mono text-xs font-semibold text-pink-700">
                {supplier.id}
              </div>
              <div className="font-semibold text-pink-700">
                {supplier.farmName}
              </div>
              <div className="text-sm text-pink-900/50">
                {supplier.flowerType} · {batches.length} รอบการตัด
              </div>
            </div>

            {batches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-pink-900/15 px-4 py-6 text-center text-sm text-pink-900/50">
                ฟาร์มนี้ยังไม่มีรอบการตัดให้ออกฉลาก
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {batches
                  .slice()
                  .reverse()
                  .map((b) => (
                    <div key={b.id} className="space-y-3">
                      <QrLabel
                        supplier={supplier}
                        batch={b}
                        traceUrl={traceUrl(b.id)}
                      />
                      <div className="text-center">
                        <button
                          onClick={() => print(b)}
                          className="inline-flex items-center gap-2 rounded-xl border border-pink-900/15 bg-white px-4 py-2 text-sm font-medium text-pink-800 hover:bg-pink-50"
                        >
                          <Printer size={16} /> พิมพ์ฉลาก
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Only this renders on print */}
      <div className="print-only">
        {printBatch && supplier ? (
          <QrLabel
            supplier={supplier}
            batch={printBatch}
            traceUrl={traceUrl(printBatch.id)}
          />
        ) : null}
      </div>
    </>
  );
}
