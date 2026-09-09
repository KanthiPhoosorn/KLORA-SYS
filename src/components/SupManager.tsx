"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import FarmSettingsForm from "@/components/FarmSettingsForm";
import type { Supplier, User } from "@/lib/types";

type Tab = "producer" | "logistic";
type SupStatus = "active" | "suspended";
const th = "px-5 py-3.5 text-center text-[13px] font-semibold text-white";
const STATUS_LABEL: Record<SupStatus, string> = { active: "เปิดใช้งาน", suspended: "ระงับการใช้งาน" };

// Figma #102: a coloured status pill that opens a menu (เปิดใช้งาน / ระงับการใช้งาน).
function StatusDropdown({
  value, onChange, disabled, busy,
}: {
  value: SupStatus; onChange?: (v: SupStatus) => void; disabled?: boolean; busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const pill = value === "active" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500";
  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button" disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${pill} disabled:opacity-60`}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : null}
        {STATUS_LABEL[value]} <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled ? (
        <div onClick={(e) => e.stopPropagation()} className="absolute left-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
          {(["active", "suspended"] as SupStatus[]).map((v) => (
            <button key={v} type="button" onClick={() => { setOpen(false); if (v !== value) onChange?.(v); }} className="block w-full px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
              {STATUS_LABEL[v]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SupManager({
  suppliers,
  logistics,
}: {
  suppliers: Supplier[];
  logistics: User[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("producer");
  const [supId, setSupId] = useState("");
  const [farm, setFarm] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editSup, setEditSup] = useState<Supplier | null>(null);

  const farmNames = [...new Set(suppliers.map((s) => s.farmName))];
  const supRows = suppliers.filter(
    (s) =>
      (!supId || s.id.toLowerCase().includes(supId.toLowerCase())) &&
      (farm === "all" || s.farmName === farm),
  );

  async function setStatus(s: Supplier, status: "active" | "suspended") {
    if (status === s.status) return;
    setBusyId(s.id);
    await fetch(`/api/suppliers/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้งาน</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-slate-200">
        {[
          { key: "producer", label: "จัดการผู้ผลิต" },
          { key: "logistic", label: "จัดการขนส่ง" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`-mb-px border-b-2 pb-3 text-[15px] transition ${
              tab === t.key ? "border-brand-purple font-semibold text-brand-purple" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "producer" ? (
        <>
          {/* Filters */}
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">SUP ID</label>
              <input value={supId} onChange={(e) => setSupId(e.target.value)} placeholder="SUP - 00214" className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none focus:border-brand-purple" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">ชื่อฟาร์ม</label>
              <select value={farm} onChange={(e) => setFarm(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none focus:border-brand-purple">
                <option value="all">ทุกฟาร์ม</option>
                {farmNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">จัดการผู้ผลิต</h2>
              <button onClick={() => { setSupId(""); setFarm("all"); }} className="rounded-[8px] border border-brand-purple px-4 py-2 text-[13px] font-medium text-brand-purple hover:bg-brand-purple-light">
                จัดการทั้งหมด
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-brand-purple-head">
                    <th className={th}>SUP ID</th>
                    <th className={th}>แหล่งผลิต</th>
                    <th className={th}>จังหวัด</th>
                    <th className={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {supRows.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">ไม่พบผู้ผลิต</td></tr>
                  ) : supRows.map((s) => (
                    <tr key={s.id} onClick={() => setEditSup(s)} className="cursor-pointer border-b border-slate-50 text-center last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{s.id}</td>
                      <td className="px-5 py-3.5 text-slate-800">{s.farmName}</td>
                      <td className="px-5 py-3.5 text-slate-600">{s.province ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <StatusDropdown value={s.status} busy={busyId === s.id} onChange={(v) => setStatus(s, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* จัดการขนส่ง — logistics accounts, mirrored layout */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">จัดการขนส่ง</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-brand-purple-head">
                  <th className={th}>รหัสผู้ใช้</th>
                  <th className={th}>บริษัทขนส่ง</th>
                  <th className={th}>สาขา</th>
                  <th className={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {logistics.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">ยังไม่มีบัญชีขนส่ง</td></tr>
                ) : logistics.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 text-center last:border-0">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{u.id}</td>
                    <td className="px-5 py-3.5 text-slate-800">{u.company ?? u.username}</td>
                    <td className="px-5 py-3.5 text-slate-600">{u.branch ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <StatusDropdown value="active" disabled />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!editSup} onClose={() => setEditSup(null)} title={editSup ? `แก้ไขข้อมูล ${editSup.id}` : ""} wide>
        {editSup ? <FarmSettingsForm supplier={editSup} /> : null}
      </Modal>
    </div>
  );
}
