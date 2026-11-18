"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, CheckCircle2, Loader2, ScanLine } from "lucide-react";
import { packTime } from "@/lib/pack-photo";
import { formatThaiDate } from "@/components/DateField";

// สแกนรับของ (9 Nov 2026): the carrier scans (or types) the lot code on the parcel, sees the lot, and confirms
// receipt with its condition and, optionally, the tracking number. A handheld scanner types the code and presses
// Enter, so the text box is the main path; the camera reads the QR with BarcodeDetector, else jsQR on a canvas.
interface LotSummary {
  id: string; farmName: string; product: string; quantity: string; cutDate: string;
  cancelled: boolean; printed: boolean; receivedAt: string | null; receivedCondition: "ok" | "damaged" | null;
  trackingNo: string | null; trackingBy: "farm" | "carrier" | null;
}

// a pasted QR link (corta.tech/t/LOT-… or /trace/BAT-…) → just the code
const lotIdOf = (text: string) => text.trim().replace(/^.*\/(?:t|trace)\//, "").replace(/[?#].*$/, "").toUpperCase();

export default function ScanQr({ initialLot = "" }: { initialLot?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastCode = useRef("");
  const [on, setOn] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [code, setCode] = useState(initialLot);
  const [lot, setLot] = useState<LotSummary | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookErr, setLookErr] = useState<string | null>(null);
  const [cond, setCond] = useState<"ok" | "damaged" | "">("");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const id = lotIdOf(raw);
    if (!id) return;
    lastCode.current = id;
    setCode(id);
    setLooking(true); setLookErr(null); setLot(null); setDone(null); setFormErr(null);
    setCond(""); setNote(""); setTracking("");
    try {
      const r = await fetch(`/api/batches/${encodeURIComponent(id)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setLookErr(d.error || "ค้นหาล็อตไม่สำเร็จ");
      else setLot(d as LotSummary);
    } catch { setLookErr("เชื่อมต่อไม่ได้ ลองอีกครั้ง"); }
    setLooking(false);
  }, []);

  // ?lot= opens a lot directly
  useEffect(() => { if (initialLot) void lookup(initialLot); }, [initialLot, lookup]);

  // camera: BarcodeDetector when the browser has it, else jsQR on a canvas frame about every 250 ms
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> }; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
        // some browsers ship the detector without QR support, so check before trusting it
        const qrOk = BD ? await BD.getSupportedFormats?.().then((f) => f.includes("qr_code"), () => false) ?? true : false;
        const detector = BD && qrOk ? new BD({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        let working = false;
        timer = setInterval(async () => {
          if (working || !v.videoWidth) return;
          working = true;
          try {
            let text: string | undefined;
            if (detector) text = (await detector.detect(v))[0]?.rawValue;
            else if (jsQR) {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) { ctx.drawImage(v, 0, 0); const img = ctx.getImageData(0, 0, canvas.width, canvas.height); text = jsQR(img.data, img.width, img.height)?.data; }
            }
            if (text && lotIdOf(text) !== lastCode.current) void lookup(text);
          } catch { /* a bad frame: try the next one */ }
          working = false;
        }, 250);
      } catch { setCamErr("ไม่สามารถเข้าถึงกล้องได้ กรุณาระบุรหัสล็อตด้วยตนเอง"); setOn(false); }
    })();
    return () => { stopped = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on, lookup]);

  async function confirm() {
    if (!lot) return;
    setFormErr(null);
    if (!cond) { setFormErr("กรุณาเลือกสภาพสินค้า"); return; }
    if (cond === "damaged" && !note.trim()) { setFormErr("กรุณาระบุความเสียหาย"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/batches/${encodeURIComponent(lot.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive", condition: cond, note: note.trim() || undefined, trackingNo: tracking.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setFormErr(d.error || "บันทึกไม่สำเร็จ");
      else { setDone(`รับของล็อต ${lot.id} แล้ว`); setLot(null); }
    } catch { setFormErr("เชื่อมต่อไม่ได้ ลองอีกครั้ง"); }
    setBusy(false);
  }

  function next() {
    setDone(null); setLot(null); setLookErr(null); setCode(""); lastCode.current = "";
    inputRef.current?.focus();
  }

  const inputCls = "w-full rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สแกนรับของ</h1>
        <p className="mt-0.5 text-[13px] text-slate-400">สแกน QR บนพัสดุ หรือพิมพ์รหัสล็อตแล้วกด Enter เพื่อบันทึกว่ารับของแล้ว</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void lookup(code); }} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-1 items-center gap-2 px-3">
          <ScanLine size={18} className="text-slate-400" />
          <input ref={inputRef} autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="รหัสล็อต เช่น LOT-2610-0001" aria-label="รหัสล็อต" className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
        <button type="submit" disabled={looking} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{looking ? "กำลังค้นหา…" : "ค้นหา"}</button>
      </form>
      {lookErr ? <p className="rounded-[5px] bg-red-50 px-3 py-2 text-[13px] text-[#ee443f]">{lookErr}</p> : null}

      {lot ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-[15px] font-bold text-slate-900">{lot.id}</p>
            <p className="text-[13px] text-slate-600">{lot.product} · {lot.quantity}</p>
            <p className="text-[12px] text-slate-400">{lot.farmName} · เก็บเกี่ยว {formatThaiDate(lot.cutDate)}</p>
          </div>
          {lot.cancelled ? (
            <p className="rounded-[8px] bg-slate-100 px-3 py-2 text-[13px] text-slate-600">รายการนี้ถูกยกเลิกแล้ว</p>
          ) : !lot.printed ? (
            <div className="rounded-[8px] bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              ยังไม่ได้พิมพ์ฉลาก QR · <Link href={`/logistic/search?q=${encodeURIComponent(lot.id)}`} className="font-medium underline">ไปพิมพ์ฉลาก</Link>
            </div>
          ) : lot.receivedAt ? (
            <p className="rounded-[8px] bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
              รับแล้วเมื่อ {packTime(lot.receivedAt)} · {lot.receivedCondition === "damaged" ? "สภาพ: เสียหาย" : "สภาพ: ปกติ"}
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">เลขพัสดุ <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="เช่น TH0123456789" className={inputCls} />
              </div>
              <div>
                <p className="mb-1 text-[13px] font-medium text-slate-700">สภาพสินค้า</p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="สภาพสินค้า">
                  {([["ok", "ปกติ"], ["damaged", "เสียหาย"]] as const).map(([v, label]) => (
                    <button key={v} type="button" role="radio" aria-checked={cond === v} onClick={() => setCond(v)}
                      className={`rounded-[10px] border px-3 py-2.5 text-sm font-medium transition ${cond === v ? (v === "ok" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-[#ee443f] bg-red-50 text-[#ee443f]") : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">หมายเหตุ{cond === "damaged" ? <span className="text-[#ee443f]"> *</span> : <span className="font-normal text-slate-400"> (ไม่บังคับ)</span>}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder={cond === "damaged" ? "ระบุความเสียหาย" : ""} className={inputCls} />
              </div>
              {formErr ? <p className="text-[12px] text-[#ee443f]">{formErr}</p> : null}
              <button type="button" onClick={confirm} disabled={busy} className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[8px] bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} ยืนยันรับของ
              </button>
            </div>
          )}
        </div>
      ) : null}

      {done ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[14px] font-medium text-emerald-800"><CheckCircle2 size={18} /> {done}</span>
          <button type="button" onClick={next} className="rounded-[8px] bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">สแกนล็อตถัดไป</button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
        <div className="relative aspect-square w-full">
          {on ? (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-slate-400">
              <div className="text-center">
                <Camera size={40} className="mx-auto" />
                <p className="mt-2 text-sm">เปิดกล้องเพื่อสแกน QR</p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/70" />
        </div>
        <div className="flex items-center justify-center gap-2 bg-white p-3">
          <button type="button" onClick={() => { setCamErr(null); setOn((v) => !v); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {on ? <><CameraOff size={16} /> ปิดกล้อง</> : <><Camera size={16} /> เปิดกล้อง</>}
          </button>
        </div>
      </div>
      {camErr ? <p className="rounded-[5px] bg-amber-50 px-3 py-2 text-[13px] text-amber-700">{camErr}</p> : null}
    </div>
  );
}
