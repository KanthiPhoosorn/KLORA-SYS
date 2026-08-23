"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Search, CameraOff } from "lucide-react";

export default function ScanQr() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (on) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(() => setErr("ไม่สามารถเข้าถึงกล้องได้ — กรุณาระบุ SUP ID ด้วยตนเอง"));
    }
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [on]);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const id = code.trim();
    if (id) router.push(`/logistic/search?q=${encodeURIComponent(id)}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สแกน QR Code</h1>
        <p className="mt-0.5 text-[13px] text-slate-400">สแกน QR บนพัสดุ หรือระบุ SUP ID เพื่อค้นหา</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        <div className="relative aspect-square w-full">
          {on ? (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-slate-400">
              <div className="text-center">
                <Camera size={40} className="mx-auto" />
                <p className="mt-2 text-sm">แตะเพื่อเปิดกล้อง</p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/70" />
        </div>
        <div className="flex items-center justify-center gap-2 bg-white p-3">
          <button onClick={() => setOn((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {on ? <><CameraOff size={16} /> ปิดกล้อง</> : <><Camera size={16} /> เปิดกล้อง</>}
          </button>
        </div>
      </div>

      {err ? <p className="rounded-[5px] bg-amber-50 px-3 py-2 text-[13px] text-amber-700">{err}</p> : null}

      <form onSubmit={go} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-1 items-center gap-2 px-3">
          <Search size={18} className="text-slate-400" />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ระบุ SUP ID เช่น SUP-2026-0002" className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
        <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">ค้นหา</button>
      </form>
    </div>
  );
}
