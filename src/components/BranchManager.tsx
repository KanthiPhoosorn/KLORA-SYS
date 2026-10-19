"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, Share2, Download, RefreshCw, Loader2, X, Pencil } from "lucide-react";
import TileMap from "@/components/TileMap";
import AddressFields, { type AddressValue } from "@/components/AddressFields";
import type { BranchEvent, BranchStatus } from "@/lib/types";

// จัดการระบบ › แท็บ "สาขา" — head office only (doc tab "Logistic", 17 Oct 2026):
//   1. the company's one branch sign-up link (copy · LINE · QR · new link · close)
//   2. branches waiting for approval — name opens the details with a map; approve / reject with a reason
//   3. all branches — name opens this month's summary, editable details, members, history; disable / enable
export interface BranchView {
  id: string;
  name: string;
  isHq: boolean;
  status: BranchStatus;
  phone?: string;
  address?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  rejectReason?: string;
  history: BranchEvent[];
  admin?: { name: string; email: string };
  members: { name: string; email: string; admin: boolean }[];
  month: { rounds: number; weightKg: number; co2e: number };
  /** shown on ข้อมูลรายสาขา (active, or disabled with lots) */
  listed?: boolean;
}

const fmtDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }) : "–");
const fmtShort = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "–");
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const fullAddress = (b: BranchView) => {
  const bkk = b.province === "กรุงเทพมหานคร";
  return [b.address, b.subdistrict && `${bkk ? "แขวง" : "ตำบล"}${b.subdistrict}`, b.district && `${bkk ? "เขต" : "อำเภอ"}${b.district}`, b.province && (bkk ? b.province : `จังหวัด${b.province}`), b.postcode].filter(Boolean).join(" ") || "–";
};
const where = (b: BranchView) => (b.district ? `${b.province === "กรุงเทพมหานคร" ? "เขต" : "อ."}${b.district}` : "");

export default function BranchManager({ company, join, branches }: {
  company: string;
  join: { token: string | null; createdAt?: string; createdBy?: string };
  branches: BranchView[];
}) {
  const router = useRouter();
  const [link, setLink] = useState(join);
  const [origin, setOrigin] = useState("https://corta.tech");
  useEffect(() => setOrigin(window.location.origin), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<BranchView | null>(null);
  const [reason, setReason] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const url = link.token ? `${origin}/logistic/join/${link.token}` : "";
  const pending = branches.filter((b) => b.status === "pending");
  const all = branches.filter((b) => b.status === "active" || b.status === "disabled");
  const shown = branches.find((b) => b.id === open) ?? null;

  async function linkAction(action: "new" | "close") {
    setBusy(`link-${action}`); setErr(null);
    const r = await fetch("/api/logistic/branch-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error || "ทำรายการไม่สำเร็จ");
    else { setLink({ token: d.token, createdAt: d.createdAt, createdBy: d.createdBy }); setToast(action === "new" ? "สร้างลิงก์ใหม่แล้ว · ลิงก์เดิมใช้ไม่ได้แล้ว" : "ปิดลิงก์แล้ว"); }
    setBusy(null); setConfirmNew(false);
  }
  async function act(b: BranchView, body: Record<string, unknown>, done?: string): Promise<boolean> {
    setBusy(`${b.id}-${String(body.action)}`); setErr(null);
    const r = await fetch(`/api/logistic/branches/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setErr(d.error || "ทำรายการไม่สำเร็จ"); return false; }
    if (done) setToast(done + (d.emailSent === false && (body.action === "approve" || body.action === "reject") ? " (ส่งอีเมลไม่สำเร็จ)" : ""));
    router.refresh();
    return true;
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  }
  async function downloadQr() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/qr?data=${encodeURIComponent(url)}&m=2`;
    const loaded = await new Promise((res, rej) => { img.onload = res; img.onerror = rej; }).then(() => true, () => false);
    if (!loaded) { setErr("โหลด QR ไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1024, 1024);
    ctx.drawImage(img, 32, 32, 960, 960);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `Corta-ลิงก์ลงทะเบียนสาขา-${company}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }
  const lineText = `${company} เชิญสาขาลงทะเบียนใช้งาน Corta ${url}`;

  const btn = "inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";

  return (
    <div className="space-y-5">
      {err ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{err}</p> : null}

      {/* 1 · the branch sign-up link */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-[17px] font-bold text-slate-900">ลิงก์ลงทะเบียนสาขา</h3>
        <p className="mt-1 text-[13px] text-slate-500">ส่งลิงก์นี้ให้สาขาของบริษัทเพื่อลงทะเบียนใช้งาน สาขาที่ลงทะเบียนผ่านลิงก์นี้จะเริ่มใช้งานได้หลังจากสำนักงานใหญ่อนุมัติแล้ว</p>
        {link.token ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr?data=${encodeURIComponent(url)}&m=2`} alt="QR ลิงก์ลงทะเบียนสาขา" className="size-28 shrink-0 rounded-lg border border-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <a href={url} target="_blank" rel="noreferrer" className="block truncate text-[15px] font-medium text-blue-700 hover:underline">{url.replace(/^https?:\/\//, "")}</a>
              <p className="text-[12.5px] text-slate-500">สร้างเมื่อ {fmtDay(link.createdAt)}{link.createdBy ? ` โดย ${link.createdBy}` : ""} · สถานะ <span className="font-medium text-emerald-700">เปิดใช้งาน</span></p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="button" onClick={copy} className={btn}>{copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>
                <a href={`https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#06C755] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"><Share2 size={14} /> แชร์ทาง LINE</a>
                <button type="button" onClick={downloadQr} className={btn}><Download size={14} /> ดาวน์โหลด QR Code</button>
                <button type="button" onClick={() => setConfirmNew(true)} className={btn}><RefreshCw size={14} /> สร้างลิงก์ใหม่</button>
                <button type="button" onClick={() => linkAction("close")} disabled={busy === "link-close"} className="rounded-[8px] px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">{busy === "link-close" ? <Loader2 size={14} className="mr-1 inline animate-spin" /> : null}ปิดลิงก์</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[13px] text-slate-600">{link.createdAt ? "ลิงก์ถูกปิดอยู่ สาขาใหม่ยังลงทะเบียนไม่ได้" : "ยังไม่มีลิงก์ลงทะเบียนสาขา"}</p>
            <button type="button" onClick={() => linkAction("new")} disabled={busy === "link-new"} className="ml-auto inline-flex items-center gap-1.5 rounded-[8px] bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {busy === "link-new" ? <Loader2 size={14} className="animate-spin" /> : null} สร้างลิงก์
            </button>
          </div>
        )}
      </section>

      {/* 2 · waiting for approval */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-[17px] font-bold text-slate-900">สาขาที่รอการอนุมัติ ({pending.length})</h3>
        <p className="mt-1 text-[13px] text-slate-500">กดชื่อสาขาเพื่อตรวจสอบข้อมูลก่อนอนุมัติ สาขาที่ไม่ได้รับการอนุมัติจะไม่สามารถบันทึกข้อมูลในระบบได้</p>
        <div className="mt-4 overflow-x-auto">
          <table className="tbl w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[13px] text-slate-500">
                <th className="px-3 py-2.5 font-medium">ชื่อสาขา</th><th className="px-3 py-2.5 font-medium">จังหวัด</th><th className="px-3 py-2.5 font-medium">ผู้ดูแลสาขา</th><th className="px-3 py-2.5 font-medium">วันที่ลงทะเบียน</th><th className="px-3 py-2.5 text-right font-medium">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px] text-slate-400">ไม่มีสาขาที่รอการอนุมัติ</td></tr>
              ) : pending.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3"><button type="button" onClick={() => setOpen(b.id)} className="text-left font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">{b.name}</button>{where(b) ? <div className="text-[12px] text-slate-500">{where(b)}</div> : null}</td>
                  <td className="px-3 py-3 text-slate-700">{b.province ?? "–"}</td>
                  <td className="px-3 py-3"><div className="text-slate-800">{b.admin?.name ?? "–"}</div>{b.admin ? <div className="text-[12px] text-slate-500">{b.admin.email}</div> : null}</td>
                  <td className="px-3 py-3 text-slate-700">{fmtShort(b.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button type="button" onClick={() => { setRejecting(b); setReason(""); }} className="rounded-[8px] border border-red-300 px-3.5 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50">ไม่อนุมัติ</button>
                      <button type="button" disabled={busy === `${b.id}-approve`} onClick={() => act(b, { action: "approve" }, `อนุมัติ${b.name}แล้ว · ส่งอีเมลแจ้งผู้ดูแลสาขา`)} className="inline-flex items-center gap-1 rounded-[8px] bg-blue-600 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy === `${b.id}-approve` ? <Loader2 size={13} className="animate-spin" /> : null}อนุมัติ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3 · all branches */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-[17px] font-bold text-slate-900">สาขาทั้งหมด ({all.length})</h3>
        <p className="mt-1 text-[13px] text-slate-500">กดชื่อสาขาเพื่อดูข้อมูล สมาชิก และสรุปการใช้งานของสาขา</p>
        <div className="mt-4 overflow-x-auto">
          <table className="tbl w-full min-w-[780px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[13px] text-slate-500">
                <th className="px-3 py-2.5 font-medium">ชื่อสาขา</th><th className="px-3 py-2.5 font-medium">จังหวัด</th><th className="px-3 py-2.5 font-medium">ผู้ดูแลสาขา</th><th className="px-3 py-2.5 font-medium">สมาชิก</th><th className="px-3 py-2.5 font-medium">สถานะ</th><th className="px-3 py-2.5 text-right font-medium">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {all.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3"><button type="button" onClick={() => setOpen(b.id)} className="text-left font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">{b.name}</button></td>
                  <td className="px-3 py-3 text-slate-700">{b.province ?? "–"}</td>
                  <td className="px-3 py-3 text-slate-800">{b.admin?.name ?? (b.isHq ? "ผู้ดูแลสำนักงานใหญ่" : "–")}</td>
                  <td className="px-3 py-3 text-slate-700">{b.members.length} คน</td>
                  <td className="px-3 py-3"><StatusPill status={b.status} /></td>
                  <td className="px-3 py-3 text-right">
                    {b.isHq ? <span className="text-slate-400">–</span> : b.status === "active" ? (
                      <button type="button" disabled={busy === `${b.id}-disable`} onClick={() => act(b, { action: "disable" }, `ปิดการใช้งาน${b.name}แล้ว`)} className={btn}>ปิดการใช้งาน</button>
                    ) : (
                      <button type="button" disabled={busy === `${b.id}-enable`} onClick={() => act(b, { action: "enable" }, `เปิดการใช้งาน${b.name}แล้ว`)} className={btn}>เปิดการใช้งาน</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {shown ? (
        <BranchSheet
          b={shown}
          busy={busy}
          onClose={() => setOpen(null)}
          onApprove={async () => { if (await act(shown, { action: "approve" }, `อนุมัติ${shown.name}แล้ว · ส่งอีเมลแจ้งผู้ดูแลสาขา`)) setOpen(null); }}
          onReject={() => { setRejecting(shown); setReason(""); }}
          onToggle={async () => { await act(shown, { action: shown.status === "active" ? "disable" : "enable" }, shown.status === "active" ? `ปิดการใช้งาน${shown.name}แล้ว` : `เปิดการใช้งาน${shown.name}แล้ว`); }}
          onSave={(patch) => act(shown, { action: "edit", ...patch }, "บันทึกข้อมูลสาขาแล้ว")}
        />
      ) : null}

      {rejecting ? (
        <Overlay onClose={() => setRejecting(null)} label={`ไม่อนุมัติ${rejecting.name}`}>
          <div className="p-6">
            <h3 className="text-[20px] font-bold text-slate-900">ไม่อนุมัติ{rejecting.name}</h3>
            <p className="mt-2 text-[14px] text-slate-600">กรุณาระบุเหตุผล ระบบจะแจ้งเหตุผลนี้ให้ผู้ลงทะเบียนทราบทางอีเมล</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} autoFocus placeholder="เช่น ไม่ใช่สาขาของบริษัท หรือข้อมูลที่อยู่ไม่ถูกต้อง" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-[14px] outline-none focus:border-red-400" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="rounded-[10px] border border-slate-300 px-5 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50">ยกเลิก</button>
              <button type="button" disabled={!reason.trim() || busy === `${rejecting.id}-reject`} onClick={async () => { if (await act(rejecting, { action: "reject", reason }, `ไม่อนุมัติ${rejecting.name} · ส่งอีเมลแจ้งเหตุผลแล้ว`)) { setRejecting(null); setOpen(null); } }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-red-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {busy === `${rejecting.id}-reject` ? <Loader2 size={15} className="animate-spin" /> : null} ยืนยันไม่อนุมัติ
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {confirmNew ? (
        <Overlay onClose={() => setConfirmNew(false)} label="สร้างลิงก์ใหม่">
          <div className="p-6">
            <h3 className="text-[19px] font-bold text-slate-900">สร้างลิงก์ใหม่?</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">ลิงก์เดิมจะใช้ไม่ได้ทันที สาขาที่ลงทะเบียนไว้แล้วไม่ได้รับผลกระทบ</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmNew(false)} className="rounded-[10px] border border-slate-300 px-5 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50">ยกเลิก</button>
              <button type="button" disabled={busy === "link-new"} onClick={() => linkAction("new")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-blue-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy === "link-new" ? <Loader2 size={15} className="animate-spin" /> : null} สร้างลิงก์ใหม่</button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {toast ? <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] text-white shadow-lg">{toast}</div> : null}
    </div>
  );
}

function StatusPill({ status }: { status: BranchStatus }) {
  const s = { active: ["ใช้งาน", "bg-emerald-50 text-emerald-700"], disabled: ["ปิดการใช้งาน", "bg-slate-100 text-slate-500"], pending: ["รอการอนุมัติ", "bg-amber-50 text-amber-700"], rejected: ["ไม่อนุมัติ", "bg-red-50 text-red-600"] }[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${s[1]}`}>{s[0]}</span>;
}

function Overlay({ children, onClose, label, wide }: { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-[150px_1fr] gap-3 py-1.5 text-[14px]"><span className="text-slate-500">{k}</span><span className="text-slate-800">{v}</span></div>;
}

/** One branch: pending → details + map + approve / reject; otherwise this month, editable details, members, history. */
function BranchSheet({ b, busy, onClose, onApprove, onReject, onToggle, onSave }: {
  b: BranchView; busy: string | null;
  onClose: () => void; onApprove: () => void; onReject: () => void; onToggle: () => void;
  onSave: (patch: Record<string, string>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(b.name);
  const [phone, setPhone] = useState(b.phone ?? "");
  const [addr, setAddr] = useState<AddressValue>({ address: b.address ?? "", province: b.province ?? "", district: b.district ?? "", subdistrict: b.subdistrict ?? "", postcode: b.postcode ?? "", gps: b.lat != null && b.lng != null ? `${b.lat}, ${b.lng}` : "" });
  const [errs, setErrs] = useState<Record<string, string | undefined>>({});
  const pending = b.status === "pending";
  const inputCls = (bad: boolean) => `w-full rounded-[8px] border bg-white px-3 py-2.5 text-[14px] outline-none ${bad ? "border-[#ee443f]" : "border-gray-300 focus:border-blue-600"}`;
  const head = pending
    ? `ลงทะเบียนเมื่อ ${fmtDay(b.createdAt)} เวลา ${fmtTime(b.createdAt)} น.`
    : b.isHq ? `สร้างเมื่อ ${fmtDay(b.createdAt)}` : `อนุมัติเมื่อ ${fmtDay(b.decidedAt ?? b.createdAt)}${b.decidedBy && b.decidedBy !== "migration" ? ` โดย ${b.decidedBy}` : ""}`;

  async function save() {
    const e: Record<string, string> = {};
    if (!b.isHq && !name.trim()) e.name = "กรุณากรอกชื่อสาขา";
    if (!phone.trim()) e.phone = "กรุณากรอกหมายเลขโทรศัพท์";
    if (!addr.address.trim()) e.address = "กรุณากรอกที่อยู่";
    if (!addr.subdistrict) e.subdistrict = "กรุณาเลือกตำบล/แขวง";
    if (!addr.gps.trim()) e.gps = "กรุณาระบุพิกัดที่ตั้ง";
    setErrs(e);
    if (Object.keys(e).length) return;
    const patch: Record<string, string> = { phone, address: addr.address, province: addr.province, district: addr.district, subdistrict: addr.subdistrict, gps: addr.gps };
    if (!b.isHq) patch.name = name;
    if (await onSave(patch)) setEditing(false);
  }

  return (
    <Overlay onClose={onClose} label={b.name} wide>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-6">
        <div>
          <h3 className="text-[22px] font-bold text-slate-900">{b.name}</h3>
          <p className="mt-1 text-[13.5px] text-slate-500">{head}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={b.status} />
          <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
      </div>
      <div className="space-y-6 px-6 py-5">
        {!pending ? (
          <section>
            <p className="mb-3 text-[15px] font-semibold text-blue-700">สรุปการใช้งานเดือนนี้</p>
            <div className="grid grid-cols-3 gap-3">
              {[["จำนวนรอบการจัดส่ง", b.month.rounds.toLocaleString()], ["ปริมาณสินค้า", `${b.month.weightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} กก.`], ["การปล่อย CO₂e ขนส่ง", `${b.month.co2e.toLocaleString(undefined, { maximumFractionDigits: 1 })} กก.`]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-3 py-3"><p className="text-[12px] text-slate-500">{k}</p><p className="mt-1 text-[19px] font-bold text-slate-900">{v}</p></div>
              ))}
            </div>
            {/* to ข้อมูลรายสาขา with this branch picked — its dashboard is one click from there (doc "Logistic", 18 Oct 2026) */}
            {b.listed ? <Link href={`/logistic/branches?b=${b.id}`} className="mt-2 inline-block text-[13px] text-blue-700 underline underline-offset-2">ดูในหน้าข้อมูลรายสาขา</Link> : null}
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-blue-700">ข้อมูลสาขา</p>
            {!pending && !editing ? <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[13px] text-blue-700 underline underline-offset-2"><Pencil size={13} /> แก้ไข</button> : null}
          </div>
          {editing ? (
            <div className="space-y-3">
              {!b.isHq ? (
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-700">ชื่อสาขา</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls(!!errs.name)} />
                  {errs.name ? <p className="mt-1 text-[12px] text-[#ee443f]">{errs.name}</p> : null}
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">หมายเลขโทรศัพท์</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls(!!errs.phone)} />
                {errs.phone ? <p className="mt-1 text-[12px] text-[#ee443f]">{errs.phone}</p> : null}
              </div>
              <AddressFields value={addr} onChange={setAddr} errs={errs} clearErr={(k) => setErrs((e) => ({ ...e, [k]: undefined }))} addressLabel="ที่อยู่" gpsPlaceholder="เช่น 19.9105, 99.8406" gpsHint="ใช้สำหรับคำนวณระยะทางการขนส่งของสาขา" inputCls={inputCls} labelCls="mb-1 block text-[13px] font-medium text-slate-700" req={null} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditing(false)} className="rounded-[8px] border border-slate-300 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">ยกเลิก</button>
                <button type="button" onClick={save} disabled={busy === `${b.id}-edit`} className="inline-flex items-center gap-1.5 rounded-[8px] bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy === `${b.id}-edit` ? <Loader2 size={14} className="animate-spin" /> : null} บันทึก</button>
              </div>
            </div>
          ) : (
            <>
              {pending ? <Row k="ชื่อสาขา" v={b.name} /> : null}
              <Row k="หมายเลขโทรศัพท์" v={b.phone ?? "–"} />
              <Row k="ที่อยู่" v={fullAddress(b)} />
              {pending ? <Row k="พิกัดที่ตั้ง" v={b.lat != null && b.lng != null ? `${b.lat}, ${b.lng}` : "–"} /> : null}
              {pending && b.lat != null && b.lng != null ? <div className="mt-3"><TileMap lat={b.lat} lng={b.lng} zoom={14} height={220} caption="ตำแหน่งตามพิกัดที่กรอก" /></div> : null}
            </>
          )}
        </section>

        {pending ? (
          <section>
            <p className="mb-2 text-[15px] font-semibold text-blue-700">ผู้ดูแลสาขา</p>
            <Row k="ชื่อผู้ใช้งาน" v={b.admin?.name ?? "–"} />
            <Row k="อีเมล" v={b.admin?.email ?? "–"} />
          </section>
        ) : (
          <>
            <section>
              <p className="mb-2 text-[15px] font-semibold text-blue-700">สมาชิก ({b.members.length})</p>
              {b.members.length ? (
                <ul className="divide-y divide-slate-100">
                  {b.members.map((m) => (
                    <li key={m.email} className="flex items-center justify-between py-2.5">
                      <span><span className="block text-[14px] text-slate-800">{m.name}</span><span className="block text-[12.5px] text-slate-500">{m.email}</span></span>
                      <span className="text-[13px] text-slate-500">{m.admin ? (b.isHq ? "ผู้ดูแลสำนักงานใหญ่" : "ผู้ดูแลสาขา") : "สมาชิก"}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-slate-400">ยังไม่มีสมาชิก</p>}
            </section>
            <section>
              <p className="mb-2 text-[15px] font-semibold text-blue-700">ประวัติ</p>
              <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-slate-700">
                {[...b.history].reverse().map((h, i) => <li key={i}>{fmtShort(h.at)} {h.by && h.by !== "migration" ? `${h.by} ` : ""}{h.text}</li>)}
              </ul>
            </section>
          </>
        )}
      </div>
      {/* closing is the X only (doc "Logistic", 18 Oct 2026) — the head office's own window has no footer */}
      {pending || !b.isHq ? (
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {pending ? (
            <>
              <button type="button" onClick={onReject} className="rounded-[10px] border border-red-300 px-5 py-2.5 text-[14px] font-medium text-red-600 hover:bg-red-50">ไม่อนุมัติ</button>
              <button type="button" onClick={onApprove} disabled={busy === `${b.id}-approve`} className="inline-flex items-center gap-1.5 rounded-[10px] bg-blue-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy === `${b.id}-approve` ? <Loader2 size={15} className="animate-spin" /> : null} อนุมัติสาขา</button>
            </>
          ) : (
            <button type="button" onClick={onToggle} disabled={!!busy} className="rounded-[10px] border border-slate-300 px-5 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">{b.status === "active" ? "ปิดการใช้งานสาขา" : "เปิดการใช้งานสาขา"}</button>
          )}
        </div>
      ) : null}
    </Overlay>
  );
}
