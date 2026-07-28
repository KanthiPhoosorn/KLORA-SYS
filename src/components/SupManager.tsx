"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { SUP_STATUS } from "@/lib/status";
import type { Supplier } from "@/lib/types";

export default function SupManager({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = suppliers.filter(
    (s) =>
      !q ||
      s.id.toLowerCase().includes(q.toLowerCase()) ||
      s.farmName.includes(q),
  );

  async function toggle(s: Supplier) {
    setBusyId(s.id);
    const status = s.status === "active" ? "suspended" : "active";
    await fetch(`/api/suppliers/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">จัดการ SUP</h1>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={16} /> เพิ่ม SUP
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
        <Search size={16} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อฟาร์ม / SUP ID"
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">SUP ID</th>
              <th className="px-5 py-2.5 font-medium">ชื่อฟาร์ม</th>
              <th className="px-5 py-2.5 font-medium">จังหวัด</th>
              <th className="px-5 py-2.5 font-medium">สถานะ</th>
              <th className="px-5 py-2.5 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{s.id}</td>
                <td className="px-5 py-2.5 text-slate-800">{s.farmName}</td>
                <td className="px-5 py-2.5 text-slate-600">{s.province ?? "—"}</td>
                <td className="px-5 py-2.5">
                  <Badge tone={SUP_STATUS[s.status].tone}>{SUP_STATUS[s.status].label}</Badge>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <div className="inline-flex items-center gap-3">
                    <Link href={`/kyn/suppliers/${s.id}`} className="text-blue-600 hover:underline">
                      แก้ไข
                    </Link>
                    <button
                      onClick={() => toggle(s)}
                      disabled={busyId === s.id}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 disabled:opacity-50"
                    >
                      {busyId === s.id ? <Loader2 size={13} className="animate-spin" /> : null}
                      {s.status === "active" ? "ระงับ" : "เปิดใช้"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
