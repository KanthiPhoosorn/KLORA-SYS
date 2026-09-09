"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Search, Loader2, MoreHorizontal, User, Building2, X, CheckCircle2, ChevronLeft, ChevronRight, Link2, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import { Badge, type Tone } from "@/components/ui";
import type { Member, Invite, MemberRole } from "@/lib/types";

type Accent = "pink" | "blue";
const THEME: Record<Accent, {
  outlineBtn: string; solidBtn: string; tabActive: string; avatar: string;
  radioSel: string; radioAccent: string; pager: string; orgGrad: string; orgIcon: string; focus: string;
}> = {
  pink: {
    outlineBtn: "border-brand-pink text-brand-pink hover:bg-brand-pink-light",
    solidBtn: "bg-brand-pink hover:opacity-90",
    tabActive: "border-brand-pink text-brand-pink",
    avatar: "bg-brand-pink",
    radioSel: "border-brand-pink bg-brand-pink-light/40",
    radioAccent: "accent-brand-pink",
    pager: "bg-brand-pink",
    orgGrad: "from-brand-pink-light via-white to-emerald-50",
    orgIcon: "text-brand-pink",
    focus: "focus:border-brand-pink",
  },
  blue: {
    outlineBtn: "border-blue-600 text-blue-600 hover:bg-blue-50",
    solidBtn: "bg-blue-600 hover:bg-blue-700",
    tabActive: "border-blue-600 text-blue-600",
    avatar: "bg-blue-600",
    radioSel: "border-blue-600 bg-blue-50",
    radioAccent: "accent-blue-600",
    pager: "bg-blue-600",
    orgGrad: "from-blue-50 via-sky-50 to-emerald-50",
    orgIcon: "text-blue-600",
    focus: "focus:border-blue-500",
  },
};

const ROLE_TABLE: Record<MemberRole, string> = { org_admin: "ผู้ดูแลองค์กร", member: "สมาชิก" };
const ROLE_RADIO: { key: MemberRole; label: string; desc: string }[] = [
  { key: "member", label: "สมาชิก", desc: "ใช้งานระบบและจัดการข้อมูลตามสิทธิ์ที่ได้รับ" },
  { key: "org_admin", label: "แอดมิน", desc: "จัดการสมาชิก ส่งคำเชิญ และกำหนดสิทธิ์ให้สมาชิกได้" },
];
const MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function joinLabel(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function fmtNum(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
}
function fmtNumTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const expiryIso = (invitedAt: string) => new Date(new Date(invitedAt).getTime() + 7 * 86400000).toISOString();
function inviteStatus(iv: Invite): { key: string; label: string; tone: Tone } {
  if (iv.status === "cancelled") return { key: "cancelled", label: "ยกเลิกแล้ว", tone: "neutral" };
  if (iv.status === "accepted") return { key: "accepted", label: "ตอบรับแล้ว", tone: "green" };
  if (Date.now() > new Date(expiryIso(iv.invitedAt)).getTime()) return { key: "expired", label: "หมดอายุ", tone: "neutral" };
  return { key: "pending", label: "รอตอบรับ", tone: "amber" };
}
const th = "px-5 py-3.5 text-center text-[13px] font-semibold text-white";

function Counter({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl bg-white/85 px-5 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500"><User size={13} className={icon} /> {label}</div>
      <div className="mt-0.5 text-[22px] font-bold text-slate-900">{value} คน</div>
    </div>
  );
}

export default function TeamManager({
  members, invites, orgName, accent = "pink", joinedAt,
}: {
  members: Member[]; invites: Invite[]; orgName: string; accent?: Accent; joinedAt?: string;
}) {
  const router = useRouter();
  const T = THEME[accent];
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [invQ, setInvQ] = useState("");
  const [invRole, setInvRole] = useState("all");
  const [invStatus, setInvStatus] = useState("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [roleEdit, setRoleEdit] = useState<Member | null>(null);
  const [roleChoice, setRoleChoice] = useState<MemberRole>("member");
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invite | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; sub?: string } | null>(null);

  const pending = invites.filter((i) => inviteStatus(i).key === "pending");
  const admins = members.filter((m) => m.role === "org_admin").length;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const filtered = useMemo(
    () => members.filter((m) =>
      (roleFilter === "all" || m.role === roleFilter) &&
      (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase()))),
    [members, q, roleFilter],
  );
  const filteredInv = useMemo(
    () => invites.filter((iv) =>
      (invRole === "all" || iv.role === invRole) &&
      (invStatus === "all" || inviteStatus(iv).key === invStatus) &&
      (!invQ || iv.email.toLowerCase().includes(invQ.toLowerCase()))),
    [invites, invQ, invRole, invStatus],
  );

  const showToast = (title: string, sub?: string) => { setToast({ title, sub }); setTimeout(() => setToast(null), 3000); };

  function addEmail() {
    const e = emailDraft.trim().replace(/,$/, "");
    if (!e) return;
    if (!EMAIL_RE.test(e)) { setError("รูปแบบอีเมลไม่ถูกต้อง"); return; }
    if (!inviteEmails.includes(e)) setInviteEmails((x) => [...x, e]);
    setEmailDraft(""); setError(null);
  }
  async function invite() {
    const emails = [...inviteEmails];
    const d = emailDraft.trim();
    if (d && EMAIL_RE.test(d) && !emails.includes(d)) emails.push(d);
    if (emails.length === 0) { setError("กรุณาระบุอีเมลอย่างน้อย 1 รายการ"); return; }
    setBusy(true); setError(null);
    try {
      for (const email of emails) {
        const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: inviteRole }) });
        if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `เชิญ ${email} ไม่สำเร็จ`); }
      }
      setInviteOpen(false); setInviteEmails([]); setEmailDraft(""); router.refresh();
      showToast("ส่งคำเชิญสำเร็จ", `ส่งคำเชิญไปยัง ${emails.length} อีเมลเรียบร้อยแล้ว`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function saveRole() {
    if (!roleEdit) return;
    setBusy(true);
    await fetch(`/api/members/${roleEdit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: roleChoice }) });
    setBusy(false); setRoleEdit(null); router.refresh(); showToast("เปลี่ยนบทบาทสำเร็จ", "สิทธิ์การใช้งานของสมาชิกถูกอัปเดตแล้ว");
  }
  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy(true);
    await fetch(`/api/members/${removeTarget.id}`, { method: "DELETE" });
    setBusy(false); setRemoveTarget(null); router.refresh(); showToast("นำสมาชิกออกแล้ว", "สมาชิกไม่สามารถเข้าถึงระบบได้อีก");
  }
  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    await fetch(`/api/invites/${cancelTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    setBusy(false); setCancelTarget(null); router.refresh(); showToast("ยกเลิกคำเชิญสำเร็จ", "ลิงก์คำเชิญไม่สามารถใช้งานได้แล้ว");
  }
  async function copyInviteLink(iv: Invite) {
    setMenuFor(null);
    try { await navigator.clipboard.writeText(`${origin}/invite/${iv.id}`); showToast("คัดลอกลิงก์คำเชิญแล้ว"); }
    catch { showToast("คัดลอกลิงก์ไม่สำเร็จ"); }
  }

  return (
    <div className="space-y-6" onClick={() => setMenuFor(null)}>
      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
          <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
          <div><p className="text-[13px] font-semibold text-emerald-800">{toast.title}</p>{toast.sub ? <p className="text-[12px] text-emerald-600">{toast.sub}</p> : null}</div>
        </div>
      ) : null}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการองค์กร</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">จัดการสมาชิก บทบาท และคำเชิญภายในองค์กร</p>
        </div>
        <button onClick={() => setInviteOpen(true)} className={`inline-flex items-center gap-2 rounded-[10px] border px-5 py-2.5 text-sm font-semibold ${T.outlineBtn}`}>
          <UserPlus size={16} /> เชิญสมาชิก
        </button>
      </div>

      {/* Org header card */}
      <div className={`grid gap-4 rounded-2xl bg-gradient-to-r ${T.orgGrad} p-4 lg:grid-cols-[1.4fr_2fr] lg:items-center`}>
        <div className="flex items-center gap-4 px-2">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white shadow-sm"><Building2 size={26} className={T.orgIcon} /></span>
          <div>
            <div className="text-lg font-bold text-slate-900">{orgName}</div>
            <div className="text-[13px] text-slate-500">เข้าร่วมเมื่อ {joinLabel(joinedAt)}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Counter label="สมาชิกทั้งหมด" value={members.length} icon={T.orgIcon} />
          <Counter label="ผู้ดูแล" value={admins} icon={T.orgIcon} />
          <Counter label="รอตอบรับ" value={pending.length} icon={T.orgIcon} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        {(["members", "invites"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 py-2.5 text-sm font-medium ${tab === t ? T.tabActive : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t === "members" ? "สมาชิก" : `คำเชิญที่รอตอบกลับ (${pending.length})`}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] text-slate-600">ค้นหา ชื่อหรืออีเมล</label>
              <div className={`flex items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3 ${T.focus}`}>
                <Search size={16} className="text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ระบุชื่อหรืออีเมล" className="w-full bg-transparent py-2.5 text-[13px] outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] text-slate-600">บทบาท</label>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none">
                <option value="all">เลือกบทบาท</option>
                <option value="org_admin">ผู้ดูแลองค์กร</option>
                <option value="member">สมาชิก</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="bg-emerald-500"><th className={`${th} text-left`}>ผู้ใช้งาน</th><th className={th}>ใช้งานล่าสุด</th><th className={th}>บทบาท</th><th className={th}>จัดการ</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">ไม่พบสมาชิก</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 text-center">
                    <td className="px-5 py-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-full text-white ${T.avatar}`}><User size={17} /></span>
                        <div><div className="font-medium text-slate-800">{m.name}</div><div className="text-xs text-slate-400">{m.email}</div></div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-slate-600">{fmtNumTime(m.lastActiveAt)}</td>
                    <td className="px-5 py-3"><Badge tone={m.role === "org_admin" ? "violet" : "neutral"}>{ROLE_TABLE[m.role]}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="relative inline-block">
                        <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.id ? null : m.id); }} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><MoreHorizontal size={18} /></button>
                        {menuFor === m.id ? (
                          <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setRoleEdit(m); setRoleChoice(m.role); setMenuFor(null); }} className="block w-full px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50">เปลี่ยนบทบาท</button>
                            <button onClick={() => { setRemoveTarget(m); setMenuFor(null); }} className="block w-full px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50">ลบออกจากระบบ</button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager n={filtered.length} pager={T.pager} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[13px] text-slate-600">ค้นหา ชื่อหรืออีเมล</label>
              <div className="flex items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3">
                <Search size={16} className="text-slate-400" />
                <input value={invQ} onChange={(e) => setInvQ(e.target.value)} placeholder="ระบุชื่อหรืออีเมล" className="w-full bg-transparent py-2.5 text-[13px] outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] text-slate-600">บทบาท</label>
              <select value={invRole} onChange={(e) => setInvRole(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none">
                <option value="all">เลือกบทบาท</option><option value="org_admin">ผู้ดูแลองค์กร</option><option value="member">สมาชิก</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] text-slate-600">สถานะคำเชิญ</label>
              <select value={invStatus} onChange={(e) => setInvStatus(e.target.value)} className="w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none">
                <option value="all">เลือกสถานะคำเชิญ</option><option value="pending">รอตอบรับ</option><option value="expired">หมดอายุ</option><option value="cancelled">ยกเลิกแล้ว</option><option value="accepted">ตอบรับแล้ว</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="bg-emerald-500"><th className={`${th} text-left`}>ผู้ได้รับคำเชิญ</th><th className={th}>บทบาท</th><th className={th}>ส่งคำเชิญเมื่อ</th><th className={th}>วันหมดอายุ</th><th className={th}>สถานะ</th><th className={th}>จัดการ</th></tr></thead>
              <tbody>
                {filteredInv.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">ยังไม่มีคำเชิญ</td></tr>
                ) : filteredInv.map((iv) => {
                  const st = inviteStatus(iv);
                  return (
                    <tr key={iv.id} className="border-t border-slate-100 text-center">
                      <td className="px-5 py-3 text-left">
                        <div className="flex items-center gap-3">
                          <span className={`grid size-9 shrink-0 place-items-center rounded-full text-white ${T.avatar}`}><User size={17} /></span>
                          <div><div className="font-medium text-slate-800">{iv.email.split("@")[0]}</div><div className="text-xs text-slate-400">{iv.email}</div></div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><Badge tone={iv.role === "org_admin" ? "violet" : "neutral"}>{ROLE_TABLE[iv.role]}</Badge></td>
                      <td className="px-5 py-3 text-[13px] text-slate-600">{fmtNum(iv.invitedAt)}</td>
                      <td className="px-5 py-3 text-[13px] text-slate-600">{fmtNum(expiryIso(iv.invitedAt))}</td>
                      <td className="px-5 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="px-5 py-3">
                        <div className="relative inline-block">
                          <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === iv.id ? null : iv.id); }} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><MoreHorizontal size={18} /></button>
                          {menuFor === iv.id ? (
                            <div className="absolute right-0 z-10 mt-1 w-52 overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-lg" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => copyInviteLink(iv)} className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50"><Link2 size={15} /> คัดลอกลิงก์คำเชิญ</button>
                              <button onClick={() => { setCancelTarget(iv); setMenuFor(null); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50"><Trash2 size={15} /> ยกเลิกคำเชิญ</button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pager n={filteredInv.length} pager={T.pager} />
        </div>
      )}

      {/* Change role modal */}
      <Modal open={!!roleEdit} onClose={() => setRoleEdit(null)} title="เปลี่ยนบทบาทสมาชิก">
        {roleEdit ? (
          <div className="space-y-4">
            <p className="text-[13px] text-slate-500">กำหนดบทบาทและสิทธิ์การใช้งานของสมาชิกภายในองค์กร</p>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <span className={`grid size-9 place-items-center rounded-full text-white ${T.avatar}`}><User size={17} /></span>
              <div><div className="font-medium text-slate-800">{roleEdit.name}</div><div className="text-xs text-slate-400">{roleEdit.email}</div></div>
            </div>
            <div><p className="mb-1.5 text-[13px] text-slate-600">บทบาทปัจจุบัน</p><Badge tone={roleEdit.role === "org_admin" ? "violet" : "neutral"}>{ROLE_TABLE[roleEdit.role]}</Badge></div>
            <div className="space-y-2">
              <p className="text-[13px] text-slate-600">กำหนดบทบาทใหม่</p>
              {ROLE_RADIO.map((r) => (
                <label key={r.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${roleChoice === r.key ? T.radioSel : "border-slate-200"}`}>
                  <input type="radio" name="role" checked={roleChoice === r.key} onChange={() => setRoleChoice(r.key)} className={`mt-0.5 size-4 ${T.radioAccent}`} />
                  <div><div className="text-[14px] font-medium text-slate-800">{r.label}</div><div className="text-[12px] text-slate-400">{r.desc}</div></div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setRoleEdit(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={saveRole} disabled={busy} className={`inline-flex h-[38px] items-center gap-2 rounded-[8px] px-8 text-[14px] font-medium text-white disabled:opacity-60 ${T.solidBtn}`}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึก</button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Remove member modal */}
      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="นำสมาชิกออกจากระบบ?">
        {removeTarget ? (
          <div className="space-y-4">
            <p className="text-[13px] text-slate-500">คุณกำลังนำ <span className="font-medium text-slate-800">{removeTarget.name}</span> ({removeTarget.email}) ออกจากองค์กร — สมาชิกจะไม่สามารถเข้าถึงระบบได้อีก</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRemoveTarget(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={confirmRemove} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-[#ee443f] px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยัน</button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Cancel invite modal */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="ยกเลิกคำเชิญ?">
        <p className="text-[13px] text-slate-500">เมื่อยกเลิกแล้ว ลิงก์คำเชิญจะไม่สามารถใช้งานได้ หากต้องการเชิญอีกครั้งจะต้องส่งคำเชิญใหม่</p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setCancelTarget(null)} disabled={busy} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
          <button onClick={confirmCancel} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-[#ee443f] px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยัน</button>
        </div>
      </Modal>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="เชิญสมาชิกเข้าร่วมองค์กร">
        <div className="space-y-4">
          <p className="text-[13px] text-slate-500">ส่งคำเชิญให้บุคลากรเข้าร่วม {orgName}</p>
          <div>
            <label className="mb-1.5 block text-[13px] text-slate-600">อีเมลผู้รับคำเชิญ</label>
            <div className={`flex flex-wrap items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3 py-2 ${T.focus}`}>
              {inviteEmails.map((e) => (
                <span key={e} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[12px] text-slate-700">
                  {e}<button type="button" onClick={() => setInviteEmails((x) => x.filter((y) => y !== e))} className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
                </span>
              ))}
              <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEmail(); }
                  else if (e.key === "Backspace" && !emailDraft && inviteEmails.length) setInviteEmails((x) => x.slice(0, -1));
                }}
                onBlur={addEmail}
                placeholder={inviteEmails.length ? "" : "example@company.com"} className="min-w-[140px] flex-1 bg-transparent py-1 text-[13px] outline-none" />
            </div>
            <p className="mt-1 text-[12px] text-slate-400">สามารถเพิ่มได้หลายอีเมล โดยกด Enter หลังกรอกแต่ละอีเมล</p>
          </div>
          <div className="space-y-2">
            <p className="text-[13px] text-slate-600">กำหนดบทบาท <span className="text-[#ee443f]">*</span></p>
            {ROLE_RADIO.map((r) => (
              <label key={r.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${inviteRole === r.key ? T.radioSel : "border-slate-200"}`}>
                <input type="radio" name="inviteRole" checked={inviteRole === r.key} onChange={() => setInviteRole(r.key)} className={`mt-0.5 size-4 ${T.radioAccent}`} />
                <div><div className="text-[14px] font-medium text-slate-800">{r.label}</div><div className="text-[12px] text-slate-400">{r.desc}</div></div>
              </label>
            ))}
          </div>
          {error ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setInviteOpen(false)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
            <button onClick={invite} disabled={busy} className={`inline-flex h-[38px] items-center gap-2 rounded-[8px] px-8 text-[14px] font-medium text-white disabled:opacity-60 ${T.solidBtn}`}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} ส่งคำเชิญ</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Pager({ n, pager }: { n: number; pager: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-slate-500">Result {n} รายการ</span>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>1 - {Math.min(50, n)} of {n}</span>
        <div className="flex gap-1">
          <button className={`grid size-7 place-items-center rounded-md text-white ${pager}`}><ChevronLeft size={14} /></button>
          <button className={`grid size-7 place-items-center rounded-md text-white ${pager}`}><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
