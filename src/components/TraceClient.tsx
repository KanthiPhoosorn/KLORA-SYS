"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { ChevronRight, Download, FileImage, FileText, Loader2, X } from "lucide-react";

// Consumer passport helpers (Thai Post doc 9 Oct 2026 §14):
//  · SavePassport — the ⬇ button (top-right): saves what the visitor sees as a PNG or a one-page PDF.
//  · HighlightBar — the farm's จุดเด่น opens from a tappable bar (§15, Super App) in a pop-up.

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

export function HighlightBar({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`จุดเด่นของ ${title}`}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-[#E6E7E8] active:bg-[#FDECEC]">
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronRight size={20} className="shrink-0 text-slate-500" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5" onClick={() => setOpen(false)} data-no-capture>
          <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="relative max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border-t-4 border-[#EE2C34] bg-white px-5 pb-4 pt-5 shadow-xl">
            <button type="button" aria-label="ปิด" onClick={() => setOpen(false)} className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            <p className="pr-6 text-center text-[15px] font-semibold text-[#193686]">{title}</p>
            <p className="mt-3 whitespace-pre-line text-center text-[14px] leading-relaxed text-slate-600">{text}</p>
            <button type="button" onClick={() => setOpen(false)} className="mx-auto mt-3 block rounded-full bg-[#E6E7E8] px-6 py-1.5 text-[13px] font-medium text-[#193686]">ปิด</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
