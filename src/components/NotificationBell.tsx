"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Info, AlertTriangle, Lock, Upload, BarChart3, FileQuestion } from "lucide-react";
import { thaiDateFull } from "@/lib/format";
import type { Notification } from "@/lib/types";

// Figma "การแจ้งเตือน" dropdown: pick the icon from the message meaning (password / version /
// carbon / incomplete), else fall back to the notification kind. Tint follows the semantic colour.
function iconFor(n: Notification) {
  const t = `${n.title} ${n.body}`;
  if (t.includes("รหัสผ่าน")) return { Icon: Lock, cls: "bg-brand-blue-light text-brand-blue" };
  if (t.includes("เวอร์ชัน")) return { Icon: Upload, cls: "bg-brand-blue-light text-brand-blue" };
  if (t.includes("ไม่ครบ") || t.includes("กรอกข้อมูล")) return { Icon: FileQuestion, cls: "bg-brand-yellow-light text-brand-orange" };
  if (/carbon|คาร์บอน/i.test(t) && (t.includes("สูง") || t.includes("เฉลี่ย"))) return { Icon: BarChart3, cls: "bg-brand-yellow-light text-brand-orange" };
  if (n.kind === "success") return { Icon: CheckCircle2, cls: "bg-brand-green-light text-brand-green" };
  if (n.kind === "warning") return { Icon: AlertTriangle, cls: "bg-brand-yellow-light text-brand-orange" };
  return { Icon: Info, cls: "bg-brand-blue-light text-brand-blue" };
}

export default function NotificationBell({ notifs }: { notifs: Notification[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const unread = notifs.some((n) => !n.read);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
        title="แจ้งเตือน"
        aria-label="การแจ้งเตือน"
      >
        <Bell size={18} />
        {unread ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-pink ring-2 ring-white" /> : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[400px] max-w-[92vw]">
          {/* caret pointing up to the bell */}
          <div className="absolute -top-1.5 right-3 size-3 rotate-45 rounded-[2px] border-l border-t border-slate-100 bg-white" />
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div className="px-5 pb-2 pt-4">
              <h3 className="text-lg font-bold text-slate-900">การแจ้งเตือน</h3>
            </div>
            <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">ยังไม่มีการแจ้งเตือน</p>
              ) : (
                notifs.map((n) => {
                  const { Icon, cls } = iconFor(n);
                  return (
                    <div key={n.id} className={`flex items-start gap-3 px-5 py-3.5 ${n.read ? "opacity-60" : ""}`}>
                      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${cls}`}>
                        <Icon size={18} strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-[14px] font-bold text-slate-900">{n.title}</h4>
                          <time className="shrink-0 pt-0.5 text-[12px] text-slate-400">{thaiDateFull(n.createdAt)}</time>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{n.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
