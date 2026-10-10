"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Link2, Loader2, Plus, Share2 } from "lucide-react";
import Modal from "@/components/Modal";
import SelectOther from "@/components/SelectOther";
import { CARRIERS, carrierKeyFromCompany, carrierLabel } from "@/lib/carriers";
import { BRANCHES } from "@/lib/branches";
import type { CarrierKey, CarrierLink } from "@/lib/types";

type Row = CarrierLink & { farms: { id: string; code?: string; name: string }[] };
const inputCls = "w-full rounded-[8px] border border-gray-300 bg-white px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-500";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";

// "+ ชวนผู้ผลิต" on รายการรับเข้าจากผู้ผลิต (10 Oct 2026): the carrier makes a sign-up link for its farms
// (link · QR · LINE). A farm joining through it ships only with this carrier.
export default function CarrierLinkPanel({ org }: { org: { code?: string; company?: string; branch?: string } }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [kind, setKind] = useState<CarrierKey>(carrierKeyFromCompany(org.company));
  const [branch, setBranch] = useState(org.branch ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("https://corta.tech");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = (t: string) => `${origin}/c/${t}`;

  async function load() {
    setErr(null);
    const r = await fetch("/api/carrier-links");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || "โหลดลิงก์ไม่สำเร็จ"); setRows([]); return; }
    setRows(d);
  }
  useEffect(() => { if (open && org.code) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    setBusy("new"); setErr(null);
    const r = await fetch("/api/carrier-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carrierKey: kind, branch }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "สร้างลิงก์ไม่สำเร็จ"); else await load();
    setBusy(null);
  }
  async function revoke(t: string) {
    setBusy(t); setErr(null);
    const r = await fetch(`/api/carrier-links/${t}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revoke: true }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "ปิดลิงก์ไม่สำเร็จ"); else await load();
    setBusy(null);
  }
  async function copy(t: string) {
    try { await navigator.clipboard.writeText(url(t)); setCopied(t); setTimeout(() => setCopied(""), 1500); } catch { /* no clipboard */ }
  }
  const shareText = (t: string) => `${org.company ?? "ผู้ขนส่ง"} ชวนฟาร์มของคุณส่งสินค้าผ่าน Corta — สมัครที่ ${url(t)}`;

  const live = (rows ?? []).filter((r) => !r.revokedAt);
  const closed = (rows ?? []).filter((r) => r.revokedAt);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700">
        <Plus size={15} /> ชวนผู้ผลิต
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="ชวนผู้ผลิตมาส่งสินค้ากับเรา" wide>
        {!org.code ? (
          <p className="rounded-[8px] bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">บัญชีนี้ยังไม่มีรหัสองค์กร (CID) — ติดต่อ KYN ก่อนสร้างลิงก์</p>
        ) : (
          <div className="space-y-5">
            <p className="text-[13px] leading-relaxed text-slate-500">
              ส่งลิงก์หรือ QR ให้ฟาร์มที่จะมาส่งของกับ <b className="text-slate-700">{org.company ?? "บริษัทของคุณ"}</b> — ฟาร์มที่สมัครหรือผูกบัญชีผ่านลิงก์นี้
              จะส่งสินค้าได้กับผู้ขนส่งรายนี้เท่านั้น และสาขาด้านล่างจะถูกเลือกไว้เป็นสาขาต้นทางให้
            </p>
            <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label className={labelCls}>รูปแบบการจัดส่ง</label>
                <select value={kind} onChange={(e) => setKind(e.target.value as CarrierKey)} className={inputCls}>
                  {CARRIERS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>สาขาต้นทาง</label>
                <SelectOther value={branch} onChange={setBranch} options={BRANCHES.map((b) => ({ value: b.name, label: b.name }))} placeholder="ไม่ระบุสาขา" className={inputCls} />
              </div>
              <button type="button" onClick={create} disabled={busy === "new"} className="inline-flex h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-[8px] bg-blue-600 px-5 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                {busy === "new" ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} สร้างลิงก์
              </button>
            </div>
            {err ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p> : null}

            {rows === null ? (
              <p className="flex items-center gap-2 text-[13px] text-slate-400"><Loader2 size={14} className="animate-spin" /> กำลังโหลด…</p>
            ) : live.length === 0 ? (
              <p className="text-[13px] text-slate-400">ยังไม่มีลิงก์ที่เปิดใช้อยู่ — สร้างลิงก์ด้านบน</p>
            ) : (
              <ul className="space-y-3">
                {live.map((r) => (
                  <li key={r.token} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/qr?data=${encodeURIComponent(url(r.token))}&m=2`} alt={`QR ${url(r.token)}`} className="size-28 shrink-0 self-center rounded-lg border border-slate-100" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="truncate font-mono text-[13px] text-blue-700" title={url(r.token)}>{url(r.token)}</p>
                      <p className="text-[12px] text-slate-500">{carrierLabel(r.carrierKey)}{r.branch ? ` · ${r.branch}` : ""} · สร้าง {new Date(r.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</p>
                      <p className="text-[12px] text-slate-600">
                        ฟาร์มที่เข้าร่วมแล้ว <b>{r.farms.length}</b>
                        {r.farms.length ? <span className="text-slate-400"> · {r.farms.map((f) => f.name).join(", ")}</span> : null}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="button" onClick={() => copy(r.token)} className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                          {copied === r.token ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />} {copied === r.token ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
                        </button>
                        <a href={`https://line.me/R/msg/text/?${encodeURIComponent(shareText(r.token))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#06C755] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90">
                          <Share2 size={13} /> แชร์ทาง LINE
                        </a>
                        <button type="button" onClick={() => revoke(r.token)} disabled={busy === r.token} className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
                          {busy === r.token ? <Loader2 size={13} className="animate-spin" /> : null} ปิดลิงก์
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {closed.length ? (
              <p className="text-[12px] text-slate-400">ลิงก์ที่ปิดแล้ว {closed.length} ลิงก์ · ฟาร์มที่เข้าร่วมไปแล้วยังส่งกับคุณได้ตามเดิม</p>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
