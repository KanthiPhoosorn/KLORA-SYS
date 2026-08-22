"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Loader2, User } from "lucide-react";

// Avatar + id cluster with a logout action, shown in each portal's top header.
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
    <div className="flex items-center gap-2">
      {profileHref ? <Link href={profileHref} className="hover:opacity-80">{cluster}</Link> : cluster}
      <button
        onClick={logout}
        disabled={busy}
        title="ออกจากระบบ"
        className="ml-1 grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
      </button>
    </div>
  );
}
