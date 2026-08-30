"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Search, Loader2, MoreHorizontal, User, Building2, X, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "@/components/Modal";
import { Badge } from "@/components/ui";
import { thaiDateTime } from "@/lib/format";
import type { Member, Invite, MemberRole } from "@/lib/types";

const selCls = "rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-slate-700 outline-none focus:border-brand-pink";
const ROLE_TABLE: Record<MemberRole, string> = { org_admin: "ผู้ดูแลองค์กร", member: "สมาชิก" };
const ROLE_RADIO: { key: MemberRole; label: string; desc: string }[] = [
  { key: "member", label: "สมาชิก", desc: "ใช้งานระบบและจัดการข้อมูลตามสิทธิ์ที่ได้รับ" },
  { key: "org_admin", label: "แอดมิน", desc: "จัดการสมาชิก ส่งคำเชิญ และกำหนดสิทธิ์ให้สมาชิกได้" },
];

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-5 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <User size={13} className="text-brand-pink" /> {label}
      </div>
      <div className="mt-0.5 text-[22px] font-bold text-slate-900">{value} คน</div>
    </div>
  );
}

export default function TeamManager({ members, invites, orgName }: { members: Member[]; invites: Invite[]; orgName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [roleEdit, setRoleEdit] = useState<Member | null>(null);
  const [roleChoice, setRoleChoice] = useState<MemberRole>("member");
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const pending = invites.filter((i) => i.status === "pending");
  const admins = members.filter((m) => m.role === "org_admin").length;

  const filtered = useMemo(
    () =>
      members.filter(
        (m) =>
          (roleFilter === "all" || m.role === roleFilter) &&
          (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase())),
      ),
    [members, q, roleFilter],
  );

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  async function invite() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เชิญไม่สำเร็จ");
      setInviteOpen(false); setInviteEmail(""); router.refresh(); showToast("ส่งคำเชิญเรียบร้อยแล้ว");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function saveRole() {
    if (!roleEdit) return;
    setBusy(true);
    await fetch(`/api/members/${roleEdit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: roleChoice }) });
    setBusy(false); setRoleEdit(null); router.refresh(); showToast("เปลี่ยนบทบาทสำเร็จ");
  }
  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy(true);
    await fetch(`/api/members/${removeTarget.id}`, { method: "DELETE" });
    setBusy(false); setRemoveTarget(null); router.refresh(); showToast("นำสมาชิกออกจากระบบแล้ว");
  }
  async function cancelInvite(id: string) {
    await fetch(`/api/invites/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    router.refresh();
  }

  return (
    <div className="space-y-6" onClick={() => setMenuFor(null)}>
      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
          <div><p className="text-[13px] font-semibold text-slate-800">สำเร็จ</p><p className="text-[12px] text-slate-400">{toast}</p></div>
        </div>
      ) : null}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการองค์กร</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">จัดการสมาชิก บทบาท และคำเชิญภายในองค์กร</p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 rounded-[10px] border border-brand-pink px-5 py-2.5 text-sm font-semibold text-brand-pink hover:bg-brand-pink-light">
          <UserPlus size={16} /> เชิญสมาชิก
        </button>
      </div>

      {/* Org header card */}
      <div className="grid gap-4 rounded-2xl bg-gradient-to-r from-brand-pink-light via-white to-emerald-50 p-4 lg:grid-cols-[1.4fr_2fr] lg:items-center">
        <div className="flex items-center gap-4 px-2">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white shadow-sm"><Building2 size={26} className="text-brand-pink" /></span>
          <div>
            <div className="text-lg font-bold text-slate-900">{orgName}</div>
            <div className="text-[13px] text-slate-500">องค์กรผู้ผลิตดอกไม้</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Counter label="สมาชิกทั้งหมด" value={members.length} />
          <Counter label="ผู้ดูแล" value={admins} />
          <Counter label="รอตอบรับ" value={pending.length} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        {(["members", "invites"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 py-2.5 text-sm font-medium ${tab === t ? "border-brand-pink text-brand-pink" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t === "members" ? "สมาชิก" : `คำเชิญที่รอตอบกลับ (${pending.length})`}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] text-slate-600">ค้นหา ชื่อหรืออีเมล</label>
              <div className="flex items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3">
                <Search size={16} className="text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ระบุชื่อหรืออีเมล" className="w-full bg-transparent py-2.5 text-[13px] outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] text-slate-600">บทบาท</label>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={`${selCls} w-full`}>
                <option value="all">เลือกบทบาท</option>
                <option value="org_admin">ผู้ดูแลองค์กร</option>
                <option value="member">สมาชิก</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="bg-emerald-500 text-center font-semibold text-white">
                  <th className="px-5 py-3 text-left">ผู้ใช้งาน</th>
                  <th className="px-5 py-3">ใช้งานล่าสุด</th>
                  <th className="px-5 py-3">บทบาท</th>
                  <th className="px-5 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">ไม่พบสมาชิก</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 text-center last:border-0">
                    <td className="px-5 py-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-pink text-white"><User size={17} /></span>
                        <div>
                          <div className="font-medium text-slate-800">{m.name}</div>
                          <div className="text-xs text-slate-400">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{m.lastActiveAt ? thaiDateTime(m.lastActiveAt) : "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={m.role === "org_admin" ? "violet" : "neutral"}>{ROLE_TABLE[m.role]}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="relative inline-block">
                        <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.id ? null : m.id); }} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                          <MoreHorizontal size={18} />
                        </button>
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

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-slate-500">Result {filtered.length} รายการ</span>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>1 - {Math.min(50, filtered.length)} of {filtered.length}</span>
              <div className="flex gap-1">
                <button className="grid size-7 place-items-center rounded-md bg-brand-pink text-white"><ChevronLeft size={14} /></button>
                <button className="grid size-7 place-items-center rounded-md bg-brand-pink text-white"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-emerald-500 text-left font-semibold text-white">
                <th className="px-5 py-3">อีเมล</th>
                <th className="px-5 py-3">บทบาท</th>
                <th className="px-5 py-3">เชิญเมื่อ</th>
                <th className="px-5 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">ไม่มีคำเชิญ</td></tr>
              ) : invites.map((iv) => (
                <tr key={iv.id} className={`border-b border-slate-50 last:border-0 ${iv.status !== "pending" ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 text-slate-700">{iv.email}</td>
                  <td className="px-5 py-3 text-slate-600">{ROLE_TABLE[iv.role]}</td>
                  <td className="px-5 py-3 text-slate-600">{thaiDateTime(iv.invitedAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {iv.status === "pending" ? (
                      <button onClick={() => cancelInvite(iv.id)} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"><X size={13} /> ยกเลิก</button>
                    ) : <span className="text-xs text-slate-400">{iv.status === "cancelled" ? "ยกเลิกแล้ว" : "ตอบรับแล้ว"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Change role modal */}
      <Modal open={!!roleEdit} onClose={() => setRoleEdit(null)} title="เปลี่ยนบทบาทสมาชิก">
        {roleEdit ? (
          <div className="space-y-4">
            <p className="text-[13px] text-slate-500">กำหนดบทบาทและสิทธิ์การใช้งานของสมาชิกภายในองค์กร</p>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-full bg-brand-pink text-white"><User size={17} /></span>
              <div><div className="font-medium text-slate-800">{roleEdit.name}</div><div className="text-xs text-slate-400">{roleEdit.email}</div></div>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] text-slate-600">บทบาทปัจจุบัน</p>
              <Badge tone={roleEdit.role === "org_admin" ? "violet" : "neutral"}>{ROLE_TABLE[roleEdit.role]}</Badge>
            </div>
            <div className="space-y-2">
              <p className="text-[13px] text-slate-600">กำหนดบทบาทใหม่</p>
              {ROLE_RADIO.map((r) => (
                <label key={r.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${roleChoice === r.key ? "border-brand-pink bg-brand-pink-light/40" : "border-slate-200"}`}>
                  <input type="radio" name="role" checked={roleChoice === r.key} onChange={() => setRoleChoice(r.key)} className="mt-0.5 size-4 accent-brand-pink" />
                  <div><div className="text-[14px] font-medium text-slate-800">{r.label}</div><div className="text-[12px] text-slate-400">{r.desc}</div></div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setRoleEdit(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={saveRole} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-brand-pink px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึก
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Remove confirm modal */}
      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="นำสมาชิกออกจากระบบ?">
        {removeTarget ? (
          <div className="space-y-4">
            <p className="text-[13px] text-slate-500">คุณกำลังนำ <span className="font-medium text-slate-800">{removeTarget.name}</span> ({removeTarget.email}) ออกจากองค์กร — สมาชิกจะไม่สามารถเข้าถึงระบบได้อีก</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRemoveTarget(null)} className="h-[38px] rounded-[8px] border border-gray-300 px-6 text-[14px] font-medium text-slate-700 hover:bg-gray-100">ยกเลิก</button>
              <button onClick={confirmRemove} disabled={busy} className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-[#ee443f] px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยัน
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="เชิญสมาชิกเข้าร่วมองค์กร">
        <div className="space-y-4">
          <p className="text-[13px] text-slate-500">ส่งคำเชิญให้บุคลากรเข้าร่วม {orgName}</p>
          <label className="block space-y-1.5">
            <span className="text-[13px] text-slate-600">อีเมลผู้รับคำเชิญ</span>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@email.com" className={`${selCls} w-full`} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] text-slate-600">บทบาท</span>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MemberRole)} className={`${selCls} w-full`}>
              <option value="member">สมาชิก</option>
              <option value="org_admin">แอดมิน</option>
            </select>
          </label>
          {error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{error}</p> : null}
          <button onClick={invite} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-brand-pink px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} ส่งคำเชิญ
          </button>
          <p className="text-center text-[11px] text-slate-400">ระบบจะส่งอีเมลคำเชิญ (จำลองในเดโม)</p>
        </div>
      </Modal>
    </div>
  );
}
