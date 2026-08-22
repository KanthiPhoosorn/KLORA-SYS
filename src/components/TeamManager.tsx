"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Search, Trash2, Loader2, X } from "lucide-react";
import Modal from "@/components/Modal";
import { thaiDateTime } from "@/lib/format";
import type { Member, Invite } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = { org_admin: "ผู้ดูแลองค์กร", member: "ผู้ใช้งาน" };
const selCls = "rounded-[5px] border border-gray-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-pink";

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-[22px] font-bold text-slate-900">{value}</div>
    </div>
  );
}

export default function TeamManager({ members, invites }: { members: Member[]; invites: Invite[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function invite() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เชิญไม่สำเร็จ");
      setInviteOpen(false); setInviteEmail(""); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function changeRole(id: string, role: string) {
    await fetch(`/api/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    router.refresh();
  }
  async function remove(id: string) {
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function cancelInvite(id: string) {
    await fetch(`/api/invites/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการระบบ</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">จัดการสมาชิก บทบาท และคำเชิญภายในองค์กร</p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 rounded-[8px] bg-brand-pink px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          <UserPlus size={16} /> เชิญสมาชิก
        </button>
      </div>

      <section className="grid grid-cols-3 gap-4">
        <Chip label="สมาชิกทั้งหมด" value={`${members.length} คน`} />
        <Chip label="ผู้ดูแล" value={`${admins} คน`} />
        <Chip label="รอตอบรับ" value={`${pending.length} คน`} />
      </section>

      <div className="flex gap-1 border-b border-slate-200">
        {(["members", "invites"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t ? "border-brand-pink text-brand-pink" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t === "members" ? "สมาชิก" : `คำเชิญที่รอตอบกลับ (${pending.length})`}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-[5px] border border-gray-300 bg-white px-3">
              <Search size={16} className="text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อหรืออีเมล" className="w-full bg-transparent py-2 text-[13px] outline-none" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selCls}>
              <option value="all">เลือกบทบาท</option>
              <option value="org_admin">ผู้ดูแลองค์กร</option>
              <option value="member">ผู้ใช้งาน</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">ผู้ใช้งาน</th>
                  <th className="px-5 py-3 font-medium">ใช้งานล่าสุด</th>
                  <th className="px-5 py-3 font-medium">บทบาท</th>
                  <th className="px-5 py-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">ไม่พบสมาชิก</td></tr>
                ) : filtered.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.email}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{m.lastActiveAt ? thaiDateTime(m.lastActiveAt) : "—"}</td>
                    <td className="px-5 py-3">
                      <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className={selCls}>
                        <option value="org_admin">ผู้ดูแลองค์กร</option>
                        <option value="member">ผู้ใช้งาน</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => remove(m.id)} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"><Trash2 size={13} /> ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">อีเมล</th>
                <th className="px-5 py-3 font-medium">บทบาท</th>
                <th className="px-5 py-3 font-medium">เชิญเมื่อ</th>
                <th className="px-5 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">ไม่มีคำเชิญ</td></tr>
              ) : invites.map((iv) => (
                <tr key={iv.id} className={`border-b border-slate-50 last:border-0 ${iv.status !== "pending" ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 text-slate-700">{iv.email}</td>
                  <td className="px-5 py-3 text-slate-600">{ROLE_LABEL[iv.role]}</td>
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

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="เชิญสมาชิก">
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[13px] text-slate-600">อีเมล</span>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@email.com" className={`${selCls} w-full`} />
          </label>
          <label className="block space-y-1">
            <span className="text-[13px] text-slate-600">บทบาท</span>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={`${selCls} w-full`}>
              <option value="member">ผู้ใช้งาน</option>
              <option value="org_admin">ผู้ดูแลองค์กร</option>
            </select>
          </label>
          {error ? <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{error}</p> : null}
          <button onClick={invite} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-brand-pink px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} ส่งคำเชิญ
          </button>
          <p className="text-center text-[11px] text-slate-400">ระบบจะส่งอีเมลคำเชิญ (จำลองในเดโม)</p>
        </div>
      </Modal>
    </div>
  );
}
