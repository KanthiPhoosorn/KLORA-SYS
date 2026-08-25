"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, User } from "lucide-react";
import Modal from "@/components/Modal";

// Avatar + id cluster with a logout action, shown in each portal's top header
// (Supplier / Logistic / KYN all render this one component).
// Logout asks for confirmation first — see the Figma "logout modul" screen.
export default function AccountButton({
  label,
  id,
  profileHref,
}: {
  label: string;
  id: string;
  profileHref?: string;
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
      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500">
        <User size={18} />
      </span>
      <div className="leading-tight">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="font-mono text-sm font-semibold text-slate-800">{id}</div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-3">
      {profileHref ? <Link href={profileHref} className="hover:opacity-80">{cluster}</Link> : cluster}

      <span className="h-6 w-px bg-slate-200" />

      <button
        onClick={() => setConfirmOpen(true)}
        className="text-sm font-medium text-slate-600 hover:text-slate-900"
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
