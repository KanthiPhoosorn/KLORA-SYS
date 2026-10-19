"use client";

import { useState } from "react";
import { Camera, CheckCircle2, Clock, Loader2, X } from "lucide-react";
import { exifTakenAt } from "@/lib/exif";
import { shrinkImage } from "@/lib/image-shrink";
import { MAX_PACK_PHOTOS, packTime, type PackPhoto } from "@/lib/pack-photo";

// รูปถ่ายตอนแพ็ก (12 Oct 2026): up to 3 photos per round, to confirm when it was packed. On a phone the
// button opens the back camera. Before upload the browser reads the photo's capture time (EXIF, else the
// file's time), stamps date · time · farm into the picture and shrinks it; the server adds its own time.
// Photos already on the lot (edit) are only dropped from the list here — the save removes them.
export function PackPhotoBadge({ p }: { p: PackPhoto }) {
  return p.verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 size={11} /> ยืนยันเวลา</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700" title="ไม่มีเวลาถ่ายในรูป หรือถ่ายก่อนอัปโหลดเกิน 24 ชั่วโมง"><Clock size={11} /> ไม่ยืนยันเวลา</span>
  );
}

export default function PackPhotos({ value, onChange, farmName, saved = [] }: {
  value: PackPhoto[]; onChange: (v: PackPhoto[]) => void; farmName: string;
  /** ids already saved on the lot (edit) */
  saved?: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(file?: File | null) {
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith("image/")) { setErr("กรุณาเลือกไฟล์รูปภาพ"); return; }
    setBusy(true);
    try {
      const exif = file.type === "image/jpeg" ? exifTakenAt(await file.slice(0, 256 * 1024).arrayBuffer()) : undefined;
      const fromFile = file.lastModified ? new Date(file.lastModified).toISOString() : undefined;
      const takenAt = exif ?? fromFile;
      const blob = await shrinkImage(file, 1280, 0.82, { left: `แพ็ก ${packTime(takenAt ?? new Date().toISOString())} · ${farmName}`, right: "Corta" });
      const fd = new FormData();
      fd.append("file", blob, "pack.jpg");
      if (takenAt) { fd.append("takenAt", takenAt); fd.append("takenSrc", exif ? "exif" : "file"); }
      const r = await fetch("/api/pack-photos", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "อัปโหลดรูปไม่สำเร็จ");
      onChange([...value, d as PackPhoto]);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  function remove(p: PackPhoto) {
    onChange(value.filter((x) => x.id !== p.id));
    if (!saved.includes(p.id)) fetch(`/api/pack-photos/${p.id}`, { method: "DELETE" }).catch(() => undefined);
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-slate-700">รูปถ่ายตอนแพ็ก <span className="font-normal text-slate-400">(ไม่บังคับ · สูงสุด {MAX_PACK_PHOTOS} รูป)</span></p>
      <div className="flex flex-wrap gap-3">
        {value.map((p) => (
          <figure key={p.id} className="w-[150px] overflow-hidden rounded-[10px] border border-slate-200 bg-white">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="รูปถ่ายตอนแพ็ก" className="h-[110px] w-full object-cover" />
              <button type="button" onClick={() => remove(p)} aria-label="ลบรูปนี้" className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white hover:bg-black/70"><X size={14} /></button>
            </div>
            <figcaption className="space-y-1 px-2 py-1.5">
              <PackPhotoBadge p={p} />
              <p className="text-[11px] leading-tight text-slate-500">{p.takenAt ? `ถ่าย ${packTime(p.takenAt)}` : `อัปโหลด ${packTime(p.uploadedAt)}`}</p>
            </figcaption>
          </figure>
        ))}
        {value.length < MAX_PACK_PHOTOS ? (
          <label className={`flex h-[150px] w-[150px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed border-slate-300 text-[12px] text-slate-500 hover:border-brand-pink hover:text-brand-pink ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
            {busy ? "กำลังอัปโหลด…" : "ถ่ายรูปตอนแพ็ก"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        ) : null}
      </div>
      {err ? <p className="text-[12px] text-[#ee443f]">{err}</p> : null}
      <p className="text-[11px] leading-relaxed text-slate-400">ระบบประทับวันเวลาลงบนรูป และเทียบเวลาถ่ายกับเวลาอัปโหลด รูปที่ถ่ายภายใน 24 ชั่วโมงก่อนอัปโหลดจะได้ป้าย &quot;ยืนยันเวลา&quot;</p>
    </div>
  );
}
