"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut, User } from "lucide-react";
import Modal from "@/components/Modal";

// Avatar + id cluster with a logout action, shown in each portal's top header
// (Supplier / Logistic / KYN all render this one component).
// Logout asks for confirmation first — see the Figma "logout modul" screen.
export default function AccountButton({
  label,
  id,
  profileHref,
  avatar,
}: {
  label: string;
  id: string;
  profileHref?: string;
  /** profile picture (data URL) — the user icon otherwise */
  avatar?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const cluster = (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <User size={18} />}
      </span>
      <div className="hidden whitespace-nowrap leading-tight sm:block">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="font-mono text-sm font-semibold text-slate-800">{id}</div>
      </div>
    </div>
  );

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      {profileHref ? <Link href={profileHref} className="hover:opacity-80" aria-label={`โปรไฟล์ · ${label} ${id}`}>{cluster}</Link> : cluster}

      <span className="hidden h-6 w-px bg-slate-200 sm:block" />

      <button
        onClick={() => setConfirmOpen(true)}
        aria-label="ออกจากระบบ"
        className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:hidden"
      >
        <LogOut size={18} />
      </button>
      <button
        onClick={() => setConfirmOpen(true)}
        className="hidden whitespace-nowrap text-sm font-medium text-slate-600 hover:text-slate-900 sm:block"
      >
        ออกจากระบบ
      </button>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="ออกจากระบบหรือไม่?">
        <p className="text-[13px] text-slate-500">คุณจะต้องเข้าสู่ระบบอีกครั้งเพื่อใช้งานระบบ</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setConfirmOpen(false)}
            disabled={busy}
            className="h-[36px] rounded-[6px] border border-gray-300 px-5 text-[13px] font-medium text-slate-700 hover:bg-gray-100 disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            onClick={logout}
            disabled={busy}
            className="inline-flex h-[36px] items-center gap-2 rounded-[6px] bg-[#ee443f] px-5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            ออกจากระบบ
          </button>
        </div>
      </Modal>
    </div>
  );
}
