"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, Loader2, ScanLine } from "lucide-react";
import { useQrCamera } from "@/components/useQrCamera";

const KEY = "corta_miniapp_recent";

// a scanned Corta link (…/t/LOT-… or …/trace/BAT-…) or typed text -> just the code
const codeOf = (text: string) => text.trim().replace(/^.*\/(?:t|trace)\//, "").replace(/[?#].*$/, "").trim();

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 10) : [];
  } catch { return []; }
}
function saveRecent(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 10))); } catch { /* storage unavailable */ }
}

export default function MiniHome() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const busyRef = useRef(false);
  const [q, setQ] = useState("");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { setRecent(readRecent()); }, []); // after mount, so the server and first client render match

  async function lookup(raw: string) {
    const code = codeOf(raw);
    if (!code || busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/miniapp/lookup?q=${encodeURIComponent(code)}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.id === "string") {
        saveRecent(d.id);
        location.assign(`/t/${encodeURIComponent(d.id)}`);
        return; // leave busy on while the page changes
      }
      setErr(r.status === 401 ? "กรุณาเปิด Corta จากแอปไปรษณีย์ไทย" : d.error || "ค้นหาไม่สำเร็จ ลองอีกครั้ง");
    } catch { setErr("เชื่อมต่อไม่ได้ ลองอีกครั้ง"); }
    busyRef.current = false; setBusy(false);
  }

  useQrCamera(on, videoRef, (text) => { setOn(false); setQ(codeOf(text)); void lookup(text); },
    () => { setErr("ไม่สามารถเข้าถึงกล้องได้ กรุณาพิมพ์เลขพัสดุหรือรหัสล็อต"); setOn(false); });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <form onSubmit={(e) => { e.preventDefault(); void lookup(q); }} className="space-y-3">
          <label htmlFor="mini-q" className="block text-[14px] font-semibold text-slate-800">ตรวจสอบสินค้า</label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-[#EE2C34]">
            <ScanLine size={18} className="text-slate-400" />
            <input id="mini-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลขพัสดุ หรือรหัสล็อต" aria-label="เลขพัสดุ หรือรหัสล็อต"
              autoComplete="off" autoCapitalize="characters" className="w-full bg-transparent py-3 text-[15px] outline-none" />
          </div>
          <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#EE2C34] text-[15px] font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} ตรวจสอบ
          </button>
        </form>
        {err ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-[#c8232a]">{err}</p> : null}

        <button type="button" onClick={() => { setErr(null); setOn((v) => !v); }}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 text-[15px] font-medium text-slate-700">
          {on ? <><CameraOff size={16} /> ปิดกล้อง</> : <><Camera size={16} /> สแกน QR</>}
        </button>
        {on ? (
          <div className="relative mt-3 aspect-square w-full overflow-hidden rounded-xl bg-slate-900">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/70" />
          </div>
        ) : null}
      </div>

      {recent.length ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 text-[14px] font-semibold text-slate-800">ที่เคยดู</h2>
          <ul className="divide-y divide-slate-100">
            {recent.map((id) => (
              <li key={id}><Link href={`/t/${encodeURIComponent(id)}`} className="block py-2.5 text-[14px] text-slate-700">{id}</Link></li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
