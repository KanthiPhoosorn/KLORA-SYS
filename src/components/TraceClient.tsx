"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Award, ChevronRight, Download, ExternalLink, FileImage, FileText, Loader2, MapPin, Share2, X } from "lucide-react";

// Consumer passport helpers (Thai Post doc 9 Oct 2026 §14):
//  · SavePassport — the ⬇ button (top-right): saves what the visitor sees as a PNG or a one-page PDF.
//    Phones (13 Oct 2026): iPhone Safari and LINE's in-app browser only save a file inside a tap, and LINE
//    cannot save files at all — so on a phone the file is made first, then a sheet offers "บันทึก / แชร์"
//    (the system share sheet → Save Image / Files), the picture to long-press, and in LINE a link that opens
//    the page in the phone's browser. Desktops still download straight away.
//  · FarmSheet — the farm card opens the farm's details in a bottom sheet (Super App mockup) — was a pop-up.

/** A minimal one-page PDF that embeds a JPEG (no PDF library needed). */
function jpegToPdf(jpeg: Uint8Array, w: number, h: number): Blob {
  const pw = 595; // A4 width in pt; the height follows the capture
  const ph = Math.round((h / w) * pw);
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b as BlobPart); len += b.length; };
  const obj = (n: number, body: string) => { offsets[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = len;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((i) => `${String(offsets[i]).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** data: URL → Blob without fetch() (older WebKit / in-app browsers) */
function dataUrlToBlob(url: string): Blob {
  const [head, body] = url.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);
/** LINE / Facebook / Instagram in-app browsers — they cannot save files */
const inApp = () => /\bLine\/|FBAN|FBAV|Instagram/i.test(ua());
const isLine = () => /\bLine\//i.test(ua());
/** WebKit (every iPhone browser, desktop Safari) often draws images only on a second pass */
const webkit = () => /iP(hone|ad|od)/.test(ua()) || (/Safari\//.test(ua()) && !/Chrome\/|Chromium\//.test(ua()));
const phone = () => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || inApp());

type Ready = { file: File; kind: "png" | "pdf"; preview?: string };

export function SavePassport({ targetId, fileName }: { targetId: string; fileName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [lineApp, setLineApp] = useState(false);
  const [otherApp, setOtherApp] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setLineApp(isLine()); setOtherApp(inApp() && !isLine()); }, []);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("touchstart", off);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("touchstart", off); };
  }, [open]);

  async function render(kind: "png" | "pdf"): Promise<Ready> {
    const el = document.getElementById(targetId);
    if (!el) throw new Error("no page");
    const { toPng, toJpeg } = await import("html-to-image");
    // style: the page centres the passport with mx-auto — the copy keeps that margin and lands outside the canvas on a wide screen
    const opts = { pixelRatio: 2, backgroundColor: "#f8fafc", cacheBust: true, style: { margin: "0" }, filter: (n: HTMLElement) => !(n.dataset && n.dataset.noCapture !== undefined) };
    if (webkit()) await toJpeg(el, { ...opts, pixelRatio: 1, quality: 0.5 }).catch(() => undefined); // warm-up pass
    if (kind === "png") {
      const url = await toPng(el, opts);
      return { kind, preview: url, file: new File([dataUrlToBlob(url)], `${fileName}.png`, { type: "image/png" }) };
    }
    const url = await toJpeg(el, { ...opts, quality: 0.92 });
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = url; });
    const jpeg = new Uint8Array(await dataUrlToBlob(url).arrayBuffer());
    return { kind, file: new File([jpegToPdf(jpeg, img.naturalWidth, img.naturalHeight)], `${fileName}.pdf`, { type: "application/pdf" }) };
  }

  async function save(kind: "png" | "pdf") {
    setBusy(kind); setErr(null); setOpen(false);
    try {
      const r = await render(kind);
      if (phone()) setReady(r); // a phone saves inside the next tap
      else download(r.file, r.file.name);
    } catch {
      setErr("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    setBusy(null);
  }

  /** inside the tap: the system share sheet (Save Image / Save to Files), else a plain download */
  async function share() {
    if (!ready) return;
    const f = ready.file;
    try {
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: fileName }); return; }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    download(f, f.name);
  }

  const external = () => {
    const u = new URL(window.location.href);
    if (lineApp) u.searchParams.set("openExternalBrowser", "1"); // LINE opens it in Safari / Chrome
    return u.toString();
  };

  return (
    <div className="relative" ref={ref} data-no-capture>
      <button type="button" aria-label="บันทึกหน้านี้" onClick={() => setOpen((o) => !o)} className="grid size-10 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} className="text-[#EE2C34]" />}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button type="button" role="menuitem" onClick={() => save("png")} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] text-slate-700 hover:bg-slate-50"><FileImage size={16} /> บันทึกเป็นรูปภาพ</button>
          <button type="button" role="menuitem" onClick={() => save("pdf")} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] text-slate-700 hover:bg-slate-50"><FileText size={16} /> บันทึกเป็น PDF</button>
        </div>
      ) : null}
      {err ? <p className="absolute right-0 top-full mt-2 w-52 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{err}</p> : null}

      {ready ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5" onClick={() => setReady(null)}>
          <div role="dialog" aria-modal="true" aria-label="บันทึกหน้านี้" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-5 pt-4 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-bold text-slate-900">{ready.kind === "png" ? "รูปภาพพร้อมแล้ว" : "ไฟล์ PDF พร้อมแล้ว"}</p>
              <button type="button" aria-label="ปิด" onClick={() => setReady(null)} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            {ready.preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ready.preview} alt={ready.file.name} className="mx-auto mt-3 max-h-[46vh] rounded-xl object-contain ring-1 ring-slate-200" />
                <p className="mt-2 text-center text-[12px] text-slate-500">หรือกดค้างที่รูปแล้วเลือก &quot;บันทึกรูปภาพ&quot;</p>
              </>
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <FileText size={28} className="shrink-0 text-[#EE2C34]" />
                <span className="min-w-0"><span className="block truncate text-[14px] font-medium text-slate-800">{ready.file.name}</span><span className="block text-[12px] text-slate-500">{Math.max(1, Math.round(ready.file.size / 1024))} KB</span></span>
              </div>
            )}
            <button type="button" onClick={share} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#EE2C34] py-3 text-[15px] font-semibold text-white active:opacity-90">
              <Share2 size={17} /> บันทึก / แชร์
            </button>
            {lineApp || otherApp ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
                {lineApp ? "แอป LINE อาจบันทึกไฟล์ไม่ได้" : "แอปนี้อาจบันทึกไฟล์ไม่ได้"} — {lineApp
                  ? <a href={external()} className="inline-flex items-center gap-1 font-semibold underline">เปิดหน้านี้ในเบราว์เซอร์ <ExternalLink size={12} /></a>
                  : <span className="font-semibold">เปิดหน้านี้ใน Safari หรือ Chrome</span>} แล้วบันทึกอีกครั้ง
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FarmSheet({ name, address, photo, story, standards, children }: {
  name: string; address: string; photo: string; story?: string;
  /** มาตรฐานการผลิต — e.g. { title: "GAP", no: "กษ 03-9001-57-001-001234" } */
  standards: { title: string; no?: string }[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`จุดเด่นของ ${name}`}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-[#E6E7E8] active:bg-[#FDECEC]">
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronRight size={20} className="shrink-0 text-slate-500" />
      </button>
      <div className={open ? "fixed inset-0 z-50 m-0 flex items-end justify-center bg-black/45 sm:items-center sm:p-5" : "hidden"} onClick={() => setOpen(false)} data-no-capture>
        <div role="dialog" aria-modal="true" aria-label={name} onClick={(e) => e.stopPropagation()} className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-5 pt-2 shadow-2xl sm:rounded-3xl">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" aria-hidden />
          <button type="button" aria-label="ปิด" onClick={() => setOpen(false)} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={20} /></button>
          <div className="relative mx-auto mt-2 size-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="size-28 rounded-full object-cover object-[80%_60%] shadow-md ring-4 ring-white" />
            <span className="absolute bottom-1 right-0 grid size-8 place-items-center rounded-full bg-[#EE2C34] text-white ring-4 ring-white"><MapPin size={15} /></span>
          </div>
          <p className="mt-3 text-center text-[20px] font-bold text-slate-900">{name}</p>
          <p className="mt-1 flex items-start justify-center gap-1 text-center text-[13px] text-slate-500"><MapPin size={14} className="mt-0.5 shrink-0 text-[#EE2C34]" />{address}</p>
          <p className="mt-5 text-[15px] font-bold text-slate-900">ข้อมูลแหล่งผลิต</p>
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-slate-600">{story || "ฟาร์มยังไม่ได้เพิ่มข้อมูลแหล่งผลิต"}</p>
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#E8ECF6] text-[#193686]"><Award size={17} /></span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-slate-800">มาตรฐานการผลิต</span>
              {standards.length ? standards.map((c, i) => (
                <span key={i} className="mt-1 block">
                  <span className="block text-[14px] font-semibold text-slate-700">{c.title}</span>
                  {c.no ? <span className="block text-[12.5px] text-slate-500">{c.no}</span> : null}
                </span>
              )) : <span className="block text-[12.5px] text-slate-500">ยังไม่มีข้อมูลใบรับรองมาตรฐาน</span>}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
