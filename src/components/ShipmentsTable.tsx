"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import { CategoryTag } from "@/components/CategoryFilter";
import { CATEGORY_LABEL } from "@/lib/master-data";
import { awbUrl, parcelTrackingUrl } from "@/lib/tracking";
import type { ProductCategory } from "@/lib/types";

// รายการจัดส่ง — the farm's overview ("รายการจัดส่งล่าสุด") and ประวัติการส่งออก share this table
// (Thai Post doc 9 Oct 2026 §5). The ✏️ button opens an in-place menu; items that do not apply are
// grey with the reason:
//   รอสั่งพิมพ์ → แก้ไขข้อมูล ✓ · ใส่เลขพัสดุ ✗ · ยกเลิกรายการ ✓
//   พิมพ์แล้ว   → แก้ไขข้อมูล ✗ · ใส่/แก้เลขพัสดุ ✓ · ยกเลิกรายการ ✗ (ผู้ขนส่งยกเลิกการพิมพ์ก่อน)
//   ยกเลิก      → nothing (row greyed, kept for history, out of every total)
export interface ShipRow {
  id: string; // LOT-…
  shipDate: string;
  shipDateIso: string;
  cutDate: string;
  quantity: string;
  category: ProductCategory;
  destination: string;
  address?: string;
  carrier: string;
  trackingNo?: string;
  awbNo?: string;
  weightKg?: number;
  status: "wait" | "printed" | "cancelled";
  cancelReason?: string;
}

const STATUS = {
  wait: { label: "รอสั่งพิมพ์", cls: "bg-amber-100 text-amber-700" },
  printed: { label: "พิมพ์แล้ว", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500" },
} as const;
const REASONS = ["ข้อมูลผิด", "ไม่ได้ส่งแล้ว", "บันทึกซ้ำ", "อื่นๆ"];
const selCls = "w-full rounded-[5px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-pink";
const inputCls = "w-full rounded-[8px] border border-gray-300 bg-white px-3 py-2.5 text-[14px] text-black outline-none focus:border-brand-pink";

export default function ShipmentsTable({
  rows, filters = false, highlight, emptyText = "ยังไม่มีรอบส่งออก",
}: {
  rows: ShipRow[];
  /** ประวัติการส่งออก: show the filter bar */
  filters?: boolean;
  /** a lot to highlight (just edited) */
  highlight?: string;
  emptyText?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: "cancel" | "track"; row: ShipRow } | null>(null);
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [trackNo, setTrackNo] = useState("");
  const [trackKg, setTrackKg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBox = useRef<HTMLDivElement | null>(null);
  const [menuAt, setMenuAt] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  // close the menu on an outside click / Esc / scroll / resize (it floats over the page, see below)
  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => t instanceof Node && (!!menuRef.current?.contains(t) || !!menuBox.current?.contains(t)); // resize/scroll targets can be window/document
    const onDown = (e: MouseEvent) => { if (!inside(e.target)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    const onMove = (e: Event) => { if (!inside(e.target)) setOpen(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [open]);
  // The table scrolls sideways in its own box, which would clip a dropdown on the last rows — so the
  // menu is drawn on <body> at the pencil's position, opening upward when there is no room below.
  const toggleMenu = (id: string, el: HTMLElement) => {
    if (open === id) { setOpen(null); return; }
    const b = el.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - b.right);
    setMenuAt(b.bottom + 200 > window.innerHeight ? { bottom: window.innerHeight - b.top + 4, right } : { top: b.bottom + 4, right });
    setOpen(id);
  };

  // ---- filters (history page) ----
  const [cat, setCat] = useState<ProductCategory | "all">("all");
  const [dest, setDest] = useState("all");
  const [status, setStatus] = useState<"all" | ShipRow["status"]>("all");
  const [q, setQ] = useState("");
  const mixed = new Set(rows.map((r) => r.category)).size > 1;
  const dests = useMemo(() => Array.from(new Set(rows.map((r) => r.destination).filter(Boolean))), [rows]);
  const shown = rows.filter((r) =>
    (cat === "all" || r.category === cat) && (dest === "all" || r.destination === dest) && (status === "all" || r.status === status) &&
    (!q.trim() || `${r.id} ${r.trackingNo ?? ""} ${r.shipDate} ${r.cutDate}`.toLowerCase().includes(q.trim().toLowerCase())));

  function openModal(type: "cancel" | "track", row: ShipRow) {
    setOpen(null); setErr(null); setReason(""); setReasonOther("");
    setTrackNo(row.trackingNo ?? ""); setTrackKg(row.weightKg ? String(row.weightKg) : "");
    setModal({ type, row });
  }
  async function confirm() {
    if (!modal) return;
    setBusy(true); setErr(null);
    try {
      const body = modal.type === "cancel"
        ? { action: "cancel", reason: reason === "อื่นๆ" ? `อื่นๆ: ${reasonOther.trim()}` : reason }
        : { action: "tracking", trackingNo: trackNo, weightKg: trackKg };
      const res = await fetch(`/api/batches/${encodeURIComponent(modal.row.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setToast(modal.type === "cancel" ? `ยกเลิก ${modal.row.id} แล้ว` : `บันทึกเลขพัสดุของ ${modal.row.id} แล้ว`);
      setTimeout(() => setToast(null), 2500);
      setModal(null);
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  const menuFor = (r: ShipRow) => {
    const trackName = r.trackingNo ? "แก้เลขพัสดุ" : "ใส่เลขพัสดุ";
    if (r.status === "cancelled") return [
      { name: "แก้ไขข้อมูล", why: "รายการนี้ถูกยกเลิกแล้ว" }, { name: trackName, why: "รายการนี้ถูกยกเลิกแล้ว" }, { name: "ยกเลิกรายการ", why: "ยกเลิกแล้ว" },
    ];
    if (r.status === "printed") return [
      { name: "แก้ไขข้อมูล", why: "พิมพ์ QR แล้ว · แก้ไขไม่ได้" },
      { name: trackName, go: () => openModal("track", r) },
      { name: "ยกเลิกรายการ", why: "พิมพ์ QR แล้ว · ให้ผู้ขนส่งยกเลิกการพิมพ์ก่อน" },
    ];
    return [
      { name: "แก้ไขข้อมูล", go: () => router.push(`/app/new?edit=${encodeURIComponent(r.id)}`) },
      { name: trackName, why: "ใส่ได้หลังพิมพ์ QR แล้ว" },
      { name: "ยกเลิกรายการ", go: () => openModal("cancel", r), red: true },
    ];
  };

  const confirmOff = busy || (modal?.type === "cancel" ? !reason || (reason === "อื่นๆ" && !reasonOther.trim()) : !trackNo.trim());

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-[13px] font-medium text-slate-700 shadow-lg"><CheckCircle2 size={18} className="text-emerald-500" />{toast}</div>
      ) : null}

      {filters ? (
        <div className={`grid gap-3 sm:grid-cols-2 ${mixed ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {mixed ? (
            <label className="space-y-1"><span className="text-[12px] text-slate-500">ประเภทสินค้า</span>
              <select value={cat} onChange={(e) => setCat(e.target.value as ProductCategory | "all")} className={selCls}>
                <option value="all">ทั้งหมด</option>
                {(["flower", "fruit", "vegetable"] as ProductCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
          ) : null}
          <label className="space-y-1"><span className="text-[12px] text-slate-500">ค้นหา (รหัสล็อต / เลขพัสดุ / วันที่)</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น LOT-2610-0001" className={selCls} />
          </label>
          <label className="space-y-1"><span className="text-[12px] text-slate-500">ปลายทาง</span>
            <select value={dest} onChange={(e) => setDest(e.target.value)} className={selCls}>
              <option value="all">ทุกจังหวัด</option>
              {dests.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="space-y-1"><span className="text-[12px] text-slate-500">สถานะ</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selCls}>
              <option value="all">ทุกสถานะ</option>
              {(Object.keys(STATUS) as ShipRow["status"][]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      {filters ? <p className="text-[13px] text-slate-500">Result {shown.length} รายการ</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="bg-emerald-500 text-left text-white">
              <th className="whitespace-nowrap px-4 py-3 font-semibold">วันที่ส่ง</th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">รหัสล็อต</th>
              {mixed ? <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">ประเภท</th> : null}
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">จำนวน</th>
              <th className="w-[232px] whitespace-nowrap px-4 py-3 font-semibold">ปลายทาง</th>
              <th className="w-[172px] whitespace-nowrap px-4 py-3 font-semibold">ขนส่ง</th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">เลขพัสดุ</th>
              <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">สถานะ</th>
              <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-slate-400">{rows.length ? "ไม่พบรายการ" : emptyText}</td></tr>
            ) : shown.map((r) => {
              const off = r.status === "cancelled";
              const st = STATUS[r.status];
              const link = r.awbNo ? awbUrl(r.awbNo) : parcelTrackingUrl(r.carrier, r.trackingNo);
              const trackText = r.awbNo ? `AWB ${r.awbNo}` : r.trackingNo;
              return (
                <tr key={r.id} className={`border-b border-slate-50 last:border-0 ${off ? "bg-slate-50/70 text-slate-400" : highlight === r.id ? "bg-amber-50" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-3">{r.shipDate}</td>
                  <td className={`whitespace-nowrap px-4 py-3 font-mono text-[12px] ${off ? "line-through" : "text-slate-700"}`}>{r.id}</td>
                  {mixed ? <td className="px-4 py-3 text-center"><CategoryTag category={r.category} /></td> : null}
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular">{r.quantity}</td>
                  <td className="px-4 py-3">
                    <p className="max-w-[200px] truncate" title={r.address ? `${r.destination} · ${r.address}` : r.destination}>{r.destination || "—"}</p>
                    {r.address ? <p className="max-w-[200px] truncate text-[11px] text-slate-400" title={r.address}>{r.address}</p> : null}
                  </td>
                  <td className="px-4 py-3"><p className="max-w-[140px] truncate" title={r.carrier}>{r.carrier || "—"}</p></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {trackText ? (
                      link && !off ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] text-blue-600 hover:underline">{trackText}<ExternalLink size={11} /></a>
                        : <span className="font-mono text-[12px]">{trackText}</span>
                    ) : <span className={r.status === "printed" ? "text-[12px] text-amber-600" : "text-slate-300"}>{r.status === "printed" ? "ยังไม่มี" : "—"}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`} title={off && r.cancelReason ? `เหตุผล: ${r.cancelReason}` : undefined}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="relative inline-block" ref={open === r.id ? menuRef : undefined}>
                      <button type="button" aria-label={`จัดการรายการ ${r.id}`} aria-expanded={open === r.id} aria-haspopup="menu" onClick={(e) => toggleMenu(r.id, e.currentTarget)}
                        className={`inline-grid size-8 place-items-center rounded-lg border transition ${open === r.id ? "border-slate-300 bg-slate-100 text-slate-700" : "border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}>
                        <Pencil size={15} />
                      </button>
                      {open === r.id && menuAt ? createPortal(
                        <div ref={menuBox} role="menu" aria-label={`จัดการรายการ ${r.id}`} style={{ position: "fixed", top: menuAt.top, bottom: menuAt.bottom, right: menuAt.right }} className="z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                          {menuFor(r).map((m) => (
                            <button key={m.name} type="button" role="menuitem" disabled={!("go" in m)} onClick={"go" in m ? m.go : undefined}
                              className={`block w-full px-4 py-2.5 text-left ${"go" in m ? "hover:bg-slate-50" : "cursor-not-allowed"}`}>
                              <span className={`block text-[13px] font-medium ${!("go" in m) ? "text-slate-300" : "red" in m && m.red ? "text-red-600" : "text-slate-800"}`}>{m.name}</span>
                              {"why" in m && m.why ? <span className="block text-[11px] text-slate-400">{m.why}</span> : null}
                            </button>
                          ))}
                        </div>,
                        document.body,
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!filters && rows.length ? <Link href="/app/history" className="inline-block text-[13px] font-medium text-brand-pink hover:underline">ดูทั้งหมดในประวัติการส่งออก</Link> : null}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === "cancel" ? `ยกเลิกรายการ ${modal.row.id} หรือไม่` : `${modal?.row.trackingNo ? "แก้" : "ใส่"}เลขพัสดุ · ${modal?.row.id ?? ""}`}>
        {modal?.type === "cancel" ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-slate-500">รายการจะเปลี่ยนเป็น “ยกเลิก” ไม่ถูกลบ ดูย้อนหลังได้ และไม่นับในตัวเลขสรุป · บรรจุภัณฑ์หมุนเวียนจะคืนรอบใช้งาน</p>
            <p className="text-[13px] font-semibold text-slate-800">เหตุผลที่ยกเลิก <span className="text-[#ee443f]">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((x) => (
                <button key={x} type="button" onClick={() => setReason(x)} className={`rounded-[10px] px-3 py-2.5 text-left text-[13px] ${reason === x ? "border-2 border-brand-pink bg-brand-pink-light font-medium text-[#a51f58]" : "border border-gray-300 text-slate-700 hover:bg-gray-50"}`}>
                  {reason === x ? "●" : "○"} {x}
                </button>
              ))}
            </div>
            {reason === "อื่นๆ" ? <input autoFocus value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} placeholder="ระบุเหตุผล" className={inputCls} /> : null}
          </div>
        ) : modal ? (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-500">ใส่เลขพัสดุและน้ำหนักรวมจากใบเสร็จขนส่ง · แก้ไขภายหลังได้ · น้ำหนักรวมใช้คำนวณคาร์บอนขนส่งใหม่</p>
            <label className="block"><span className="mb-1 block text-[13px] font-medium text-slate-700">เลขพัสดุ <span className="text-[#ee443f]">*</span></span>
              <input autoFocus value={trackNo} onChange={(e) => setTrackNo(e.target.value)} placeholder="EF123456789TH" className={`${inputCls} font-mono uppercase`} />
            </label>
            <label className="block"><span className="mb-1 block text-[13px] font-medium text-slate-700">น้ำหนักรวม (กก.)</span>
              <input inputMode="decimal" type="number" min="0" step="any" value={trackKg} onChange={(e) => setTrackKg(e.target.value)} placeholder="ดูจากใบเสร็จ" className={inputCls} />
            </label>
          </div>
        ) : null}
        {err ? <p className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => setModal(null)} disabled={busy} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ปิด</button>
          <button type="button" onClick={confirm} disabled={confirmOff}
            className={`inline-flex h-[38px] items-center gap-2 rounded-[8px] px-6 text-[14px] font-medium text-white disabled:opacity-50 ${modal?.type === "cancel" ? "bg-red-600 hover:bg-red-700" : "bg-brand-pink hover:opacity-90"}`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}{modal?.type === "cancel" ? "ยืนยันยกเลิก" : "บันทึก"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
