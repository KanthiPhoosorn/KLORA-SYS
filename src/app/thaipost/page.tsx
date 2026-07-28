"use client";

import { useState } from "react";
import { Search, Loader2, Printer } from "lucide-react";
import QrLabel from "@/components/QrLabel";
import type { Supplier, Batch } from "@/lib/types";

export default function ThaiPostSearchPage() {
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
      setBatches((data.batches as Batch[]).filter((b) => b.status === "computed"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function print(b: Batch) {
    setPrintBatch(b);
    setTimeout(() => window.print(), 50);
    // Log the print for the KYN Shipment/QR log + Thai Post history (fire-and-forget).
    if (supplier) {
      fetch("/api/prints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          batchId: b.id,
          destination: b.destination,
          printedBy: "Thaipost",
        }),
      }).catch(() => {});
    }
  }

  return (
    <>
      <div className="no-print grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">ค้นหา SUP ID</h1>
          <form
            onSubmit={onSearch}
            className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="สแกนหรือพิมพ์ SUP ID เช่น SUP-2026-0002"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              ค้นหา
            </button>
          </form>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          {supplier ? (
            <div className="rounded-2xl border border-pink-200 bg-pink-50/50 px-5 py-4">
              <div className="font-mono text-xs font-semibold text-pink-600">{supplier.id}</div>
              <div className="font-semibold text-pink-700">{supplier.farmName}</div>
              <div className="text-sm text-pink-900/50">
                {supplier.flowerType} · {batches.length} รอบการตัด
              </div>
            </div>
          ) : null}

          {supplier && batches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              ฟาร์มนี้ยังไม่มีรอบที่คำนวณแล้วให้ออกฉลาก
            </p>
          ) : null}
        </div>

        {/* Selected label preview */}
        <div className="space-y-4">
          {supplier && batches.length > 0 ? (
            batches
              .slice()
              .reverse()
              .map((b) => (
                <div key={b.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <QrLabel supplier={supplier} batch={b} traceUrl={traceUrl(b.id)} />
                  <div className="text-center">
                    <button
                      onClick={() => print(b)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Printer size={16} /> พิมพ์ฉลาก
                    </button>
                  </div>
                </div>
              ))
          ) : null}
        </div>
      </div>

      {/* Only this renders on print */}
      <div className="print-only">
        {printBatch && supplier ? (
          <QrLabel supplier={supplier} batch={printBatch} traceUrl={traceUrl(printBatch.id)} />
        ) : null}
      </div>
    </>
  );
}
