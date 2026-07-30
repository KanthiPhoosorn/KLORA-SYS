"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusCircle, Settings2, LogOut, Loader2 } from "lucide-react";
import TopBar from "./TopBar";
import Modal from "./Modal";
import HelpButton from "./HelpButton";
import RoundForm from "./RoundForm";
import FarmSettingsForm from "./FarmSettingsForm";
import type { Supplier } from "@/lib/types";

export default function SupTopBar({
  supplier,
  varietyOptions,
  basketOptions,
}: {
  supplier: Supplier;
  varietyOptions: string[];
  basketOptions: string[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "round" | "settings">(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const left = (
    <div className="flex items-center gap-2">
      <Link href="/" className="text-lg font-extrabold tracking-tight text-pink-500">
        KLORA
      </Link>
      <span className="text-sm text-slate-400">· ฟาร์ม</span>
      <span className="hidden font-mono text-xs text-slate-400 sm:inline">{supplier.id}</span>
    </div>
  );

  const right = (
    <>
      <button
        onClick={() => setModal("round")}
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        <PlusCircle size={16} /> <span className="hidden sm:inline">รอบส่งออก</span>
      </button>
      <button
        onClick={() => setModal("settings")}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        title="ตั้งค่าฟาร์ม"
      >
        <Settings2 size={16} /> <span className="hidden md:inline">ตั้งค่าฟาร์ม</span>
      </button>
      <HelpButton />
      <button
        onClick={logout}
        disabled={loggingOut}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-60"
        title="ออกจากระบบ"
      >
        {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
      </button>
    </>
  );

  return (
    <>
      <TopBar left={left} right={right} />

      <Modal open={modal === "round"} onClose={() => setModal(null)} title="กรอกข้อมูลรอบส่งออกใหม่" wide>
        <RoundForm
          supplier={supplier}
          varietyOptions={varietyOptions}
          basketOptions={basketOptions}
          onDone={() => setModal(null)}
        />
      </Modal>

      <Modal open={modal === "settings"} onClose={() => setModal(null)} title="ข้อมูลฟาร์ม" wide>
        <FarmSettingsForm supplier={supplier} onDone={() => setModal(null)} />
      </Modal>
    </>
  );
}
