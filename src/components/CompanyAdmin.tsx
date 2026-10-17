"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Loader2 } from "lucide-react";
import { CARRIERS, carrierLabel } from "@/lib/carriers";
import type { CarrierKey, OrgStatus } from "@/lib/types";

// KYN › บริษัทขนส่ง (doc "Logistic", 17 Oct 2026): the company invite link, companies that signed up alone
// waiting for the check, and every company with its provider type (which decides the export menu).
export interface CompanyView {
  orgCode: string;
  company: string;
  providerType: CarrierKey;
  status: OrgStatus;
  phone?: string;
  taxId?: string;
  address?: string;
  createdAt: string;
  admin?: { name: string; email: string };
  branches: number;
  pendingBranches: number;
  lots: number;
}

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "—");
const STATUS: Record<OrgStatus, [string, string]> = {
  active: ["ใช้งาน", "bg-emerald-50 text-emerald-700"],
  pending: ["รอตรวจสอบ", "bg-amber-50 text-amber-700"],
  rejected: ["ไม่ผ่าน", "bg-red-50 text-red-600"],
  suspended: ["ระงับ", "bg-slate-100 text-slate-500"],
};

export default function CompanyAdmin({ companies, invite }: { companies: CompanyView[]; invite: { token: string | null; createdAt?: string } }) {
  const router = useRouter();
  const [inv, setInv] = useState(invite);
  const [origin, setOrigin] = useState("https://corta.tech");
  useEffect(() => setOrigin(window.location.origin), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rejecting, setRejecting] = useState<CompanyView | null>(null);
  const [reason, setReason] = useState("");
  const url = inv.token ? `${origin}/logistic/register?invite=${inv.token}` : "";
  const pending = companies.filter((c) => c.status === "pending");
  const rest = companies.filter((c) => c.status !== "pending");

  async function call(key: string, path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(key); setErr(null);
    const r = await fetch(path, { method: path.includes("company-invite") ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setErr(d.error || "ทำรายการไม่สำเร็จ"); return null; }
    router.refresh();
    return d;
  }
  const org = (c: CompanyView, body: Record<string, unknown>) => call(`${c.orgCode}-${String(body.action)}`, `/api/logistic/companies/${c.orgCode}`, body);
  const btn = "inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">บริษัทขนส่ง</h1>
        <p className="mt-1 text-sm text-slate-500">ตรวจสอบบริษัทที่ลงทะเบียนเอง กำหนดประเภทผู้ให้บริการ และสร้างลิงก์เชิญบริษัท</p>
      </div>
      {err ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{err}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[17px] font-bold text-slate-900">ลิงก์เชิญบริษัท</h2>
        <p className="mt-1 text-[13px] text-slate-500">บริษัทที่ลงทะเบียนผ่านลิงก์นี้เริ่มใช้งานได้ทันที (หลังเซ็นสัญญา) — ส่วนบริษัทที่ลงทะเบียนเองจากหน้าลงทะเบียนต้องรอการตรวจสอบด้านล่าง</p>
        {inv.token ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-blue-700">{url}</code>
            <button type="button" className={btn} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } }}>
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
            </button>
            <button type="button" className={btn} disabled={busy === "inv-new"} onClick={async () => { const d = await call("inv-new", "/api/logistic/company-invite", { action: "new" }); if (d) setInv({ token: d.token as string, createdAt: d.createdAt as string }); }}>สร้างลิงก์ใหม่</button>
            <button type="button" className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50" disabled={busy === "inv-close"} onClick={async () => { if (await call("inv-close", "/api/logistic/company-invite", { action: "close" })) setInv({ token: null }); }}>ปิดลิงก์</button>
            <span className="text-[12px] text-slate-400">สร้างเมื่อ {day(inv.createdAt)}</span>
          </div>
        ) : (
          <button type="button" className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={busy === "inv-new"} onClick={async () => { const d = await call("inv-new", "/api/logistic/company-invite", { action: "new" }); if (d) setInv({ token: d.token as string, createdAt: d.createdAt as string }); }}>
            {busy === "inv-new" ? <Loader2 size={14} className="animate-spin" /> : null} สร้างลิงก์เชิญบริษัท
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[17px] font-bold text-slate-900">รอการตรวจสอบ ({pending.length})</h2>
        <p className="mt-1 text-[13px] text-slate-500">บริษัทที่ลงทะเบียนด้วยตนเอง — เข้าสู่ระบบได้ แต่ยังบันทึกข้อมูลไม่ได้จนกว่าจะผ่านการตรวจสอบ</p>
        <div className="mt-4 overflow-x-auto">
          <table className="tbl w-full min-w-[820px] text-sm">
            <thead><tr className="bg-slate-50 text-left text-[13px] text-slate-500"><th className="px-3 py-2.5 font-medium">บริษัท</th><th className="px-3 py-2.5 font-medium">ประเภท</th><th className="px-3 py-2.5 font-medium">ผู้ดูแลบัญชี</th><th className="px-3 py-2.5 font-medium">ติดต่อ</th><th className="px-3 py-2.5 font-medium">ลงทะเบียน</th><th className="px-3 py-2.5 text-right font-medium">การดำเนินการ</th></tr></thead>
            <tbody>
              {pending.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px] text-slate-400">ไม่มีบริษัทที่รอการตรวจสอบ</td></tr> : pending.map((c) => (
                <tr key={c.orgCode} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3"><div className="font-medium text-slate-900">{c.company}</div><div className="text-[12px] text-slate-500">{c.orgCode}{c.taxId ? ` · เลขผู้เสียภาษี ${c.taxId}` : ""}</div><div className="text-[12px] text-slate-500">{c.address}</div></td>
                  <td className="px-3 py-3 text-slate-700">{carrierLabel(c.providerType)}</td>
                  <td className="px-3 py-3"><div className="text-slate-800">{c.admin?.name ?? "—"}</div><div className="text-[12px] text-slate-500">{c.admin?.email}</div></td>
                  <td className="px-3 py-3 text-slate-700">{c.phone ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{day(c.createdAt)}</td>
                  <td className="px-3 py-3 text-right"><div className="inline-flex gap-2">
                    <button type="button" onClick={() => { setRejecting(c); setReason(""); }} className="rounded-[8px] border border-red-300 px-3 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50">ไม่ผ่าน</button>
                    <button type="button" disabled={busy === `${c.orgCode}-approve`} onClick={() => org(c, { action: "approve" })} className="inline-flex items-center gap-1 rounded-[8px] bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy === `${c.orgCode}-approve` ? <Loader2 size={13} className="animate-spin" /> : null}ผ่านการตรวจสอบ</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[17px] font-bold text-slate-900">บริษัททั้งหมด ({rest.length})</h2>
        <p className="mt-1 text-[13px] text-slate-500">ประเภท “ศูนย์คัดแยกสินค้า” และ “ผู้ส่งออก” มีเมนู “เพิ่มข้อมูลรอบส่งออก” · ประเภทอื่นไม่มี</p>
        <div className="mt-4 overflow-x-auto">
          <table className="tbl w-full min-w-[860px] text-sm">
            <thead><tr className="bg-slate-50 text-left text-[13px] text-slate-500"><th className="px-3 py-2.5 font-medium">บริษัท</th><th className="px-3 py-2.5 font-medium">ประเภทผู้ให้บริการ</th><th className="px-3 py-2.5 font-medium">ผู้ดูแลบัญชี</th><th className="px-3 py-2.5 text-right font-medium">สาขา</th><th className="px-3 py-2.5 text-right font-medium">ล็อต</th><th className="px-3 py-2.5 font-medium">สถานะ</th><th className="px-3 py-2.5 text-right font-medium">การดำเนินการ</th></tr></thead>
            <tbody>
              {rest.map((c) => (
                <tr key={c.orgCode} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3"><div className="font-medium text-slate-900">{c.company}</div><div className="text-[12px] text-slate-500">{c.orgCode} · ลงทะเบียน {day(c.createdAt)}</div></td>
                  <td className="px-3 py-3">
                    <select aria-label={`ประเภทผู้ให้บริการของ ${c.company}`} value={c.providerType} disabled={busy === `${c.orgCode}-type`} onChange={(e) => org(c, { action: "type", providerType: e.target.value })} className="rounded-[8px] border border-slate-300 bg-white px-2.5 py-1.5 text-[13px]">
                      {CARRIERS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3"><div className="text-slate-800">{c.admin?.name ?? "—"}</div><div className="text-[12px] text-slate-500">{c.admin?.email}</div></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{c.branches}{c.pendingBranches ? <span className="ml-1 text-[12px] text-amber-600">(+{c.pendingBranches} รอ)</span> : null}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{c.lots}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span></td>
                  <td className="px-3 py-3 text-right">
                    {c.status === "active" ? <button type="button" className={btn} disabled={!!busy} onClick={() => org(c, { action: "suspend" })}>ระงับ</button>
                      : c.status === "suspended" ? <button type="button" className={btn} disabled={!!busy} onClick={() => org(c, { action: "activate" })}>เปิดใช้งาน</button>
                      : <span className="text-slate-400">–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rejecting ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5" onClick={() => setRejecting(null)}>
          <div role="dialog" aria-modal="true" aria-label={`ไม่ผ่าน ${rejecting.company}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
            <h3 className="text-[20px] font-bold text-slate-900">ไม่ผ่านการตรวจสอบ · {rejecting.company}</h3>
            <p className="mt-2 text-[14px] text-slate-600">กรุณาระบุเหตุผล ระบบจะแจ้งเหตุผลนี้ให้ผู้ลงทะเบียนทราบทางอีเมล</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} autoFocus placeholder="เช่น ยังไม่ได้เซ็นสัญญา หรือข้อมูลบริษัทไม่ถูกต้อง" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-[14px] outline-none focus:border-red-400" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="rounded-[10px] border border-slate-300 px-5 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50">ยกเลิก</button>
              <button type="button" disabled={!reason.trim() || !!busy} onClick={async () => { if (await org(rejecting, { action: "reject", reason })) setRejecting(null); }} className="rounded-[10px] bg-red-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-red-700 disabled:opacity-50">ยืนยันไม่ผ่าน</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
