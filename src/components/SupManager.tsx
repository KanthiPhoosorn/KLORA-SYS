"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Send, X } from "lucide-react";
import Modal from "@/components/Modal";
import FarmSettingsForm from "@/components/FarmSettingsForm";
import type { Invite, Supplier, User } from "@/lib/types";

type Tab = "producer" | "logistic" | "kyn";
type SupStatus = "active" | "suspended";
type Plan = "free" | "pro";
const th = "px-5 py-3.5 text-center text-[13px] font-semibold text-white";
const STATUS_OPTS = [
  { value: "active" as const, label: "เปิดใช้งาน", pill: "bg-emerald-50 text-emerald-600" },
  { value: "suspended" as const, label: "ระงับการใช้งาน", pill: "bg-rose-50 text-rose-500" },
];
const PLAN_OPTS = [
  { value: "free" as const, label: "Free", pill: "bg-slate-100 text-slate-600" },
  { value: "pro" as const, label: "Pro", pill: "bg-brand-purple-light text-brand-purple" },
];

// Figma #102: a coloured pill that opens a small menu of options (status / plan).
function PillDropdown<T extends string>({
  value, options, onChange, disabled, busy,
}: {
  value: T; options: { value: T; label: string; pill: string }[]; onChange?: (v: T) => void; disabled?: boolean; busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const cur = options.find((o) => o.value === value) ?? options[0];
  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button" disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${cur.pill} disabled:opacity-60`}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : null}
        {cur.label} <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled ? (
        <div onClick={(e) => e.stopPropagation()} className="absolute left-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { setOpen(false); if (o.value !== value) onChange?.(o.value); }} className="block w-full px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
const StatusDropdown = (p: { value: SupStatus; onChange?: (v: SupStatus) => void; disabled?: boolean; busy?: boolean }) => <PillDropdown options={STATUS_OPTS} {...p} />;

export default function SupManager({
  suppliers,
  logistics,
  kynUsers = [],
  kynInvites = [],
  currentUserId = "",
}: {
  suppliers: Supplier[];
  logistics: User[];
  kynUsers?: User[];
  kynInvites?: Invite[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("producer");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [supId, setSupId] = useState("");
  const [farm, setFarm] = useState("all");
  const [logCompany, setLogCompany] = useState("all");
  const [logBranch, setLogBranch] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editSup, setEditSup] = useState<Supplier | null>(null);

  const farmNames = [...new Set(suppliers.map((s) => s.farmName))];

  // จัดการขนส่ง — one row per logistics account (บริษัท / สาขา / จังหวัด / สถานะ).
  const provinceOf = (branch?: string) => (branch ?? "").replace(/^สาขา\s*/, "").trim() || "—";
  const companyOf = (u: User) => u.company ?? u.username;
  const logCompanies = [...new Set(logistics.map(companyOf))];
  const logBranches = [...new Set(logistics.map((u) => u.branch).filter((x): x is string => !!x))];
  const logRows = logistics.filter(
    (u) =>
      (logCompany === "all" || companyOf(u) === logCompany) &&
      (logBranch === "all" || u.branch === logBranch),
  );
  const supRows = suppliers.filter(
    (s) =>
      (!supId || s.id.toLowerCase().includes(supId.toLowerCase())) &&
      (farm === "all" || s.farmName === farm),
  );

  async function patchSupplier(s: Supplier, body: { status?: SupStatus; plan?: Plan }) {
    setBusyId(s.id);
    await fetch(`/api/suppliers/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    router.refresh();
  }
  const setStatus = (s: Supplier, status: SupStatus) => { if (status !== s.status) return patchSupplier(s, { status }); };
  const setPlan = (s: Supplier, plan: Plan) => { if (plan !== (s.plan ?? "free")) return patchSupplier(s, { plan }); };

  // Logistic / KYN logins are suspended per user (PATCH /api/users/[id]).
  async function setUserStatus(u: User, status: SupStatus) {
    if (status === (u.status ?? "active")) return;
    setBusyId(u.id);
    await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setBusyId(null);
    router.refresh();
  }

  async function inviteKyn(e: React.FormEvent) {
    e.preventDefault();
    setInviteBusy(true); setInviteMsg(null);
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, role: "org_admin" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งคำเชิญไม่สำเร็จ");
      setInviteMsg({ ok: true, text: data.emailSent ? `ส่งคำเชิญไปที่ ${inviteEmail} แล้ว` : "บันทึกคำเชิญแล้ว แต่ระบบอีเมลยังไม่พร้อม" });
      setInviteEmail("");
      router.refresh();
    } catch (err) {
      setInviteMsg({ ok: false, text: (err as Error).message });
    } finally {
      setInviteBusy(false);
    }
  }

  async function cancelInvite(id: string) {
    setBusyId(id);
    await fetch(`/api/invites/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
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
          { key: "kyn", label: "เจ้าหน้าที่ KYN" },
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

      {tab === "kyn" ? (
        /* เจ้าหน้าที่ KYN — operator logins + invites (join link → role kyn) */
        <>
          <form onSubmit={inviteKyn} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">เชิญเจ้าหน้าที่ KYN ด้วยอีเมล</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@kynpartners.co" className="flex-1 rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none focus:border-brand-purple" />
              <button type="submit" disabled={inviteBusy} className="flex items-center justify-center gap-2 rounded-[8px] bg-brand-purple px-5 py-[10px] text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60">
                {inviteBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} ส่งคำเชิญ
              </button>
            </div>
            {inviteMsg ? <p className={`mt-2 text-[13px] ${inviteMsg.ok ? "text-emerald-600" : "text-rose-600"}`}>{inviteMsg.text}</p> : null}
            <p className="mt-2 text-[12px] text-slate-400">ผู้รับจะได้ลิงก์ตั้งชื่อผู้ใช้/รหัสผ่าน และเข้าระบบเป็นเจ้าหน้าที่ KYN ทันที</p>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">เจ้าหน้าที่ KYN</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-brand-purple-head">
                    <th className={th}>ชื่อผู้ใช้</th>
                    <th className={th}>อีเมล</th>
                    <th className={th}>รหัส</th>
                    <th className={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {kynUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 text-center last:border-0">
                      <td className="px-5 py-3.5 text-slate-800">{u.username}{u.id === currentUserId ? <span className="ml-1.5 text-[11px] text-slate-400">(คุณ)</span> : null}</td>
                      <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{u.id}</td>
                      <td className="px-5 py-3.5">
                        <StatusDropdown value={u.status ?? "active"} disabled={u.id === currentUserId} busy={busyId === u.id} onChange={(v) => setUserStatus(u, v)} />
                      </td>
                    </tr>
                  ))}
                  {kynInvites.filter((i) => i.status === "pending").map((i) => (
                    <tr key={i.id} className="border-b border-slate-50 bg-amber-50/40 text-center last:border-0">
                      <td className="px-5 py-3.5 italic text-slate-400">รอตอบรับ</td>
                      <td className="px-5 py-3.5 text-slate-600">{i.email}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{i.id}</td>
                      <td className="px-5 py-3.5">
                        <button type="button" disabled={busyId === i.id} onClick={() => cancelInvite(i.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50">
                          {busyId === i.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} ยกเลิกคำเชิญ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : tab === "producer" ? (
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
                    <th className={th}>แพ็กเกจ</th>
                    <th className={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {supRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">ไม่พบผู้ผลิต</td></tr>
                  ) : supRows.map((s) => (
                    <tr key={s.id} onClick={() => setEditSup(s)} className="cursor-pointer border-b border-slate-50 text-center last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{s.id}</td>
                      <td className="px-5 py-3.5 text-slate-800">{s.farmName}</td>
                      <td className="px-5 py-3.5 text-slate-600">{s.province ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <PillDropdown value={(s.plan ?? "free") as Plan} options={PLAN_OPTS} busy={busyId === s.id} onChange={(v) => setPlan(s, v)} />
                      </td>
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
        /* จัดการขนส่ง — logistics accounts, mirrors the producer tab */
        <>
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">บริษัท</label>
              <select value={logCompany} onChange={(e) => setLogCompany(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none focus:border-brand-purple">
                <option value="all">เลือกบริษัทที่ต้องการ</option>
                {logCompanies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">สาขา</label>
              <select value={logBranch} onChange={(e) => setLogBranch(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none focus:border-brand-purple">
                <option value="all">เลือกสาขาที่ต้องการ</option>
                {logBranches.map((br) => <option key={br} value={br}>{br}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">จัดการขนส่ง</h2>
              <button onClick={() => { setLogCompany("all"); setLogBranch("all"); }} className="rounded-[8px] border border-brand-purple px-4 py-2 text-[13px] font-medium text-brand-purple hover:bg-brand-purple-light">
                จัดการทั้งหมด
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-brand-purple-head">
                    <th className={th}>บริษัท</th>
                    <th className={th}>สาขา</th>
                    <th className={th}>จังหวัด</th>
                    <th className={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">ยังไม่มีบัญชีขนส่ง</td></tr>
                  ) : logRows.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 text-center last:border-0">
                      <td className="px-5 py-3.5 text-slate-800">{companyOf(u)}</td>
                      <td className="px-5 py-3.5 text-slate-600">{u.branch ?? "—"}</td>
                      <td className="px-5 py-3.5 text-slate-600">{provinceOf(u.branch)}</td>
                      <td className="px-5 py-3.5">
                        <StatusDropdown value={u.status ?? "active"} busy={busyId === u.id} onChange={(v) => setUserStatus(u, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={!!editSup} onClose={() => setEditSup(null)} title={editSup ? `แก้ไขข้อมูล ${editSup.id}` : ""} wide>
        {editSup ? <FarmSettingsForm supplier={editSup} /> : null}
      </Modal>
    </div>
  );
}
