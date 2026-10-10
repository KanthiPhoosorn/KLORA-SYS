"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Award, ChevronRight, Download, FileImage, FileText, Loader2, MapPin, ShieldCheck, Sprout, X } from "lucide-react";

// Consumer passport helpers (Thai Post doc 9 Oct 2026 §14):
//  · SavePassport — the ⬇ button (top-right): saves what the visitor sees as a PNG or a one-page PDF.
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

export function SavePassport({ targetId, fileName }: { targetId: string; fileName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  async function save(kind: "png" | "pdf") {
    const el = document.getElementById(targetId);
    if (!el) return;
    setBusy(kind); setErr(null); setOpen(false);
    try {
      const { toPng, toJpeg } = await import("html-to-image");
      const opts = { pixelRatio: 2, backgroundColor: "#f8fafc", cacheBust: true, filter: (n: HTMLElement) => !(n.dataset && n.dataset.noCapture !== undefined) };
      if (kind === "png") {
        const url = await toPng(el, opts);
        download(await (await fetch(url)).blob(), `${fileName}.png`);
      } else {
        const url = await toJpeg(el, { ...opts, quality: 0.92 });
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = url; });
        const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
        download(jpegToPdf(bytes, img.naturalWidth, img.naturalHeight), `${fileName}.pdf`);
      }
    } catch {
      setErr("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    setBusy(null);
  }

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
    </div>
  );
}

/** The farm card on the QR page opens this sheet (Super App mockup): photo + pin, name, address, the
 *  farm's story (ข้อมูลแหล่งผลิต) and three rows — standards, traceability, environment. Rendered with the
 *  page (hidden until tapped) so its facts are in the page; left out of the saved image. */
export function FarmSheet({ name, address, photo, story, standards, carbon, children }: {
  name: string; address: string; photo: string; story?: string; standards: string; carbon: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const rows = [
    { Icon: Award, title: "มาตรฐานการผลิต", text: standards },
    { Icon: ShieldCheck, title: "ตรวจสอบย้อนกลับ", text: "สแกน QR เพื่อดูแหล่งผลิต วันเก็บเกี่ยว และเส้นทางขนส่งของล็อตนี้" },
    { Icon: Sprout, title: "การดูแลสิ่งแวดล้อม", text: carbon },
  ];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`จุดเด่นของ ${name}`}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-[#E6E7E8] active:bg-[#FDECEC]">
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronRight size={20} className="shrink-0 text-slate-500" />
      </button>
      <div className={open ? "fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5" : "hidden"} onClick={() => setOpen(false)} data-no-capture>
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
          <ul className="mt-4 divide-y divide-[#E6E7E8] rounded-2xl bg-slate-50 px-4">
            {rows.map((r) => (
              <li key={r.title} className="flex items-start gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#E8ECF6] text-[#193686]"><r.Icon size={17} /></span>
                <span className="min-w-0"><span className="block text-[14px] font-semibold text-slate-800">{r.title}</span><span className="block text-[12.5px] leading-relaxed text-slate-500">{r.text}</span></span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-[#EE2C34] py-3 text-[15px] font-semibold text-white active:opacity-90">ปิด</button>
        </div>
      </div>
    </>
  );
}
