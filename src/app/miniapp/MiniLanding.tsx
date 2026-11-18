"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

const OPEN_FROM_APP = "กรุณาเปิด Corta จากแอปไปรษณีย์ไทย";

// Reads the handoff from the address bar, removes it at once, redeems it with our backend, then moves on.
// The handoff is single-use, so there is deliberately no retry button.
export default function MiniLanding({ signedIn }: { signedIn: boolean }) {
  const [state, setState] = useState<"working" | "none" | "error">("working");
  const [message, setMessage] = useState("");

  const ran = useRef(false); // dev Strict Mode runs effects twice; a handoff is single-use
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // the inline script in page.tsx already took the handoff out of the address bar; this covers a client-side arrival
    const w = window as unknown as { __cortaHandoff?: string };
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(location.search);
    const handoff = w.__cortaHandoff ?? (hash.get("handoff") || query.get("handoffToken") || query.get("handoff") || "");
    delete w.__cortaHandoff;
    history.replaceState(null, "", location.pathname);

    if (!handoff) {
      if (signedIn) location.replace("/miniapp/home");
      else setState("none");
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/sso/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handoffToken: handoff }),
          cache: "no-store",
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.ok) { location.replace("/miniapp/home"); return; }
        setMessage(typeof d.error === "string" ? d.error : "ระบบของไปรษณีย์ไทยขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง");
      } catch {
        setMessage("เชื่อมต่อไม่ได้ กรุณาปิดแล้วเปิด Corta ใหม่จากแอปไปรษณีย์ไทย");
      }
      setState("error");
    })();
  }, [signedIn]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/corta-logo.png" alt="Corta" className="mb-6 h-12 w-auto" />
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        {state === "working" ? (
          <div role="status" className="flex flex-col items-center gap-3 text-slate-600">
            <Loader2 size={28} className="animate-spin text-[#EE2C34]" />
            <p className="text-[15px]">กำลังเข้าสู่ระบบ…</p>
          </div>
        ) : state === "none" ? (
          <p className="text-[15px] font-medium text-slate-700">{OPEN_FROM_APP}</p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle size={28} className="text-[#EE2C34]" />
            <p className="text-[15px] font-medium text-slate-800">{message}</p>
            <p className="text-[13px] text-slate-500">กรุณาปิดหน้านี้ แล้วเปิด Corta ใหม่จากแอปไปรษณีย์ไทย</p>
          </div>
        )}
      </div>
    </div>
  );
}
