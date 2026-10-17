"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hourglass, Loader2 } from "lucide-react";

// What a logistic account sees while it waits (doc "Logistic", 17 Oct 2026): a branch for its head office,
// a company that signed up alone for KYN. It can sign in, but cannot record anything yet.
export default function PendingApproval({ kind, company, branch, registeredAt, providerLabel }: {
  kind: "branch" | "company";
  company: string;
  branch?: string;
  registeredAt: string;
  providerLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const day = new Date(registeredAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/logistic/login");
    router.refresh();
  }
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-600"><Hourglass size={28} /></span>
        <h1 className="mt-5 text-[22px] font-bold text-slate-900">{kind === "branch" ? "รอการอนุมัติจากสำนักงานใหญ่" : "รอการตรวจสอบจากผู้ดูแลระบบ"}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
          ระบบได้รับข้อมูลการลงทะเบียนของท่านแล้ว ท่านจะได้รับอีเมลแจ้งเมื่อ{kind === "branch" ? "สำนักงานใหญ่อนุมัติ" : "ผู้ดูแลระบบตรวจสอบ"}เรียบร้อย
        </p>
        <dl className="mt-5 space-y-1.5 rounded-xl bg-slate-50 px-5 py-4 text-left text-[14px]">
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-500">บริษัท</dt><dd className="font-medium text-slate-800">{company}</dd></div>
          {branch ? <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-500">สาขา</dt><dd className="font-medium text-slate-800">{branch}</dd></div> : null}
          {providerLabel ? <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-500">ประเภท</dt><dd className="font-medium text-slate-800">{providerLabel}</dd></div> : null}
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-500">วันที่ลงทะเบียน</dt><dd className="font-medium text-slate-800">{day}</dd></div>
        </dl>
        <p className="mt-5 text-[13px] leading-relaxed text-slate-500">ระหว่างรอการอนุมัติ ท่านสามารถเข้าสู่ระบบได้ แต่ยังไม่สามารถบันทึกข้อมูลหรือสร้างลิงก์เชิญผู้ผลิตได้</p>
        <button type="button" onClick={logout} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : null} ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
