"use client";

import { useState } from "react";
import { LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import Modal from "./Modal";

// "ช่องทางติดต่อแอดมิน" — help channel shown when the system has a problem (from the spec).
export default function HelpButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        title="ติดต่อแอดมิน / ขอคำแนะนำ"
      >
        <LifeBuoy size={16} />
        {compact ? null : <span className="hidden sm:inline">ช่วยเหลือ</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="ติดต่อแอดมิน · ขอคำแนะนำ">
        <p className="text-sm text-slate-600">
          หากระบบมีปัญหาหรือต้องการคำแนะนำ ติดต่อทีมงาน KLORA ได้ตามช่องทางด้านล่าง
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <a href="https://line.me/R/ti/p/@klora-support" className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50">
            <MessageCircle size={16} className="text-emerald-600" />
            <span className="text-slate-700">LINE Official: <b>@klora-support</b></span>
          </a>
          <a href="mailto:support@klora.app" className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50">
            <Mail size={16} className="text-blue-600" />
            <span className="text-slate-700">อีเมล: <b>support@klora.app</b></span>
          </a>
          <a href="tel:052000000" className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50">
            <Phone size={16} className="text-slate-500" />
            <span className="text-slate-700">โทร: <b>052-000-000</b> (จ.–ศ. 8:30–17:30)</span>
          </a>
        </div>
      </Modal>
    </>
  );
}
