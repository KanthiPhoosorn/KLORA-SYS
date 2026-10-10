"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

// A signed-in farm on /c/<token>: bind the farm to this carrier (or say why it can't).
export default function AttachCarrier({ token, company, farmName, boundTo }: { token: string; company: string; farmName: string; boundTo: "same" | string | null }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(boundTo === "same");
  const [err, setErr] = useState<string | null>(null);

  async function attach() {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/carrier-links/${token}/attach`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setDone(true); else setErr(d.error || "ผูกบัญชีไม่สำเร็จ");
    setBusy(false);
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 rounded-[8px] bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {farmName} ส่งสินค้ากับ {company} แล้ว</p>
        <Link href="/app/new" className="block rounded-[8px] bg-brand-pink px-4 py-3 text-center text-[14px] font-semibold text-white hover:opacity-90">เพิ่มข้อมูลรอบส่งออก</Link>
      </div>
    );
  }
  if (boundTo) {
    return <p className="rounded-[8px] bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">{farmName} ผูกกับ {boundTo} อยู่แล้ว — ติดต่อ KYN หากต้องการเปลี่ยนผู้ขนส่ง</p>;
  }
  return (
    <div className="space-y-2.5">
      <button type="button" onClick={attach} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-brand-pink px-4 py-3 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} ให้ {farmName} ส่งกับ {company}
      </button>
      <p className="text-center text-[12px] text-slate-400">หลังผูกแล้ว รอบส่งออกใหม่จะส่งได้กับผู้ขนส่งรายนี้เท่านั้น</p>
      {err ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p> : null}
    </div>
  );
}
