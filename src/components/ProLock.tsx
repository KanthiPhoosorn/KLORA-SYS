"use client";

import { useState } from "react";
import { Mail, MessageCircle, Phone } from "lucide-react";
import Modal from "@/components/Modal";
import { CONTACT } from "@/lib/contact";

// Freemium paywall (Figma "Lock / Pro" state): a centred card floating over a blurred,
// faded preview of the gated dashboard. Used on ภาพรวม and แดชบอร์ดคาร์บอน for free-plan farms.
// There is no self-serve billing yet — the upgrade button explains how to get KYN to enable Pro.
export default function ProLock({
  title = "ปลดล็อกแดชบอร์ดคาร์บอน",
  desc = "อัปเกรดเพื่อดูภาพรวมการปล่อย CO₂e วิเคราะห์แนวโน้ม และติดตามผลการลดคาร์บอนของฟาร์มได้ในที่เดียว",
}: {
  title?: string;
  desc?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-h-[560px]">
      {/* Blurred faux-dashboard behind the card */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none space-y-4 opacity-50 blur-[6px]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="mt-4 h-6 w-24 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex h-full items-end gap-3">
              {[40, 70, 55, 85, 60, 95].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-emerald-200" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="h-56 rounded-2xl border border-slate-100 bg-white shadow-sm" />
        </div>
      </div>

      {/* Centre card */}
      <div className="relative flex min-h-[560px] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-white px-8 py-10 text-center shadow-xl ring-1 ring-slate-100">
          <span className="inline-block rounded-full bg-brand-pink-light px-4 py-1.5 text-xs font-medium text-brand-pink">
            ฟีเจอร์สำหรับสมาชิก
          </span>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/figma/home-lock.svg" alt="" className="mx-auto my-6 h-44 w-auto" />


          <h1 className="text-2xl font-bold text-brand-pink">{title}</h1>
          <p className="mt-1.5 text-sm font-semibold text-emerald-600">ฟีเจอร์นี้รวมอยู่ในแพ็กเกจ Pro</p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">{desc}</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-7 w-full rounded-[10px] bg-brand-pink px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
            ดูแพ็กเกจและอัปเกรด
          </button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="แพ็กเกจ Pro">
        <div className="space-y-4 text-[14px] text-slate-700">
          <ul className="space-y-1.5 rounded-xl bg-brand-pink-light/60 px-4 py-3 text-[13px]">
            <li>✓ ภาพรวมการส่งออกและแนวโน้ม CO₂e รายเดือน</li>
            <li>✓ แดชบอร์ดคาร์บอน — สัดส่วนการปล่อย อันดับ และการเปรียบเทียบ</li>
            <li>✓ ประวัติการส่งออกย้อนหลังทั้งหมด</li>
          </ul>
          <p>การเปิดใช้แพ็กเกจ Pro ทำโดยทีม KYN — แจ้ง SUP ID ของฟาร์มคุณผ่านช่องทางด้านล่าง ทีมงานจะเปิดให้ภายใน 1 วันทำการ</p>
          <div className="space-y-2 text-sm">
            <a href={CONTACT.lineUrl} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50"><MessageCircle size={16} className="text-emerald-600" /> LINE Official: <b>{CONTACT.lineId}</b></a>
            <a href={`mailto:${CONTACT.email}?subject=ขอเปิดแพ็กเกจ Pro KLORA`} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50"><Mail size={16} className="text-blue-600" /> อีเมล: <b>{CONTACT.email}</b></a>
            <a href={CONTACT.phoneHref} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50"><Phone size={16} className="text-slate-500" /> โทร: <b>{CONTACT.phone}</b> ({CONTACT.hours})</a>
          </div>
        </div>
      </Modal>
    </div>
  );
}
