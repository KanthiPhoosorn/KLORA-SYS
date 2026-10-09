"use client";

import { useEffect, useState } from "react";
import { LABEL_SIZES, type LabelSize } from "@/lib/labels";

// The printable QR labels (Thai Post doc 9 Oct 2026 §13). The page size is set with @page in mm so
// the browser prints exactly on the sticker: one label per page for 60×30 / 80×25 / 40×25, or a 3×9
// A4 die-cut sheet of 60×30. QR ≥ 20 mm with a ≥ 2 mm white quiet zone, black on white, nothing on
// top of it; text never wraps (one line, "…"), never below ~6 pt.
export interface LabelData {
  id: string; // LOT-…
  product: string;
  qty: string;
  cut: string; // "ตัด 26 ก.ค. 69"
  farm: string;
  place: string; // province
  qr: string; // /api/qr?… image src
}

const PAGE: Record<LabelSize, string> = {
  "60x30": "@page { size: 60mm 30mm; margin: 0 }",
  "80x25": "@page { size: 80mm 25mm; margin: 0 }",
  "40x25": "@page { size: 40mm 25mm; margin: 0 }",
  a4: "@page { size: A4; margin: 13.5mm 15mm }",
};

export default function LabelSheet({ labels, initialSize }: { labels: LabelData[]; initialSize: LabelSize }) {
  const [size, setSize] = useState<LabelSize>(initialSize);
  const [ready, setReady] = useState(false);

  // print once every QR image has loaded (first visit only)
  useEffect(() => {
    if (!labels.length) return;
    const imgs = Array.from(document.images);
    let cancelled = false;
    Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }))))
      .then(() => { if (!cancelled) { setReady(true); setTimeout(() => window.print(), 200); } });
    return () => { cancelled = true; };
  }, [labels.length]);

  function pick(s: LabelSize) {
    setSize(s);
    // remembered per account (users.label_size)
    fetch("/api/profile/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labelSize: s }) }).catch(() => {});
  }

  const sheet = size === "a4";
  return (
    <div className={`sheet size-${size}`}>
      <style>{`
        ${PAGE[size]}
        html, body { background: #fff !important; margin: 0; }
        .sheet { font-family: var(--font-noto-thai), var(--font-inter), sans-serif; color: #000; }
        .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        .bar .opt { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 6px 10px; cursor: pointer; text-align: left; }
        .bar .opt b { display: block; font-size: 13px; }
        .bar .opt span { display: block; font-size: 11px; color: #64748b; }
        .bar .opt.on { border: 2px solid #1559b9; background: #eef4ff; }
        .bar .print { margin-left: auto; background: #1559b9; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; font-weight: 600; cursor: pointer; }
        .bar .tip { flex-basis: 100%; color: #64748b; font-size: 11.5px; }
        .labels { display: flex; flex-wrap: wrap; gap: 6mm; padding: 6mm; }
        .size-a4 .labels { display: grid; grid-template-columns: repeat(3, 60mm); grid-auto-rows: 30mm; gap: 0; padding: 0; width: 180mm; }
        .label { box-sizing: border-box; background: #fff; overflow: hidden; position: relative; outline: 1px dashed #cbd5e1; }
        .size-60x30 .label, .size-a4 .label { width: 60mm; height: 30mm; display: grid; grid-template-columns: 28mm 1fr; }
        .size-80x25 .label { width: 80mm; height: 25mm; display: grid; grid-template-columns: 7mm 1fr 25mm; }
        .size-40x25 .label { width: 40mm; height: 25mm; display: grid; grid-template-columns: 24mm 1fr; }
        .qr { background: #fff; padding: 2mm; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
        .qr img { display: block; image-rendering: pixelated; }
        .size-60x30 .qr img, .size-a4 .qr img { width: 24mm; height: 24mm; }
        .size-80x25 .qr img { width: 21mm; height: 21mm; }
        .size-40x25 .qr img { width: 20mm; height: 20mm; }
        .text { min-width: 0; padding: 2mm 2mm 2mm 0.5mm; display: flex; flex-direction: column; justify-content: space-between; }
        .text > * { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; line-height: 1.2; }
        .brand { font-weight: 800; color: #1559b9; font-size: 3.4mm; letter-spacing: -0.01em; }
        .product { font-weight: 700; font-size: 3.4mm; }
        .meta { font-size: 2.4mm; }
        .lot { font-family: ui-monospace, Menlo, monospace; font-weight: 700; font-size: 2.6mm; }
        .size-40x25 .brand { font-size: 2.8mm; } .size-40x25 .product { font-size: 2.8mm; } .size-40x25 .meta { font-size: 2.1mm; }
        /* 16 mm of text: the LOT code must stay whole — narrow proportional digits at ~6 pt instead of mono */
        .size-40x25 .text { padding-right: 1mm; }
        .size-40x25 .lot { font-family: inherit; font-size: 2mm; letter-spacing: -0.02em; overflow: visible; text-overflow: clip; }
        .band { background: #1559b9; color: #fff; display: flex; align-items: center; justify-content: center; }
        .band span { transform: rotate(-90deg); font-weight: 800; font-size: 3.2mm; white-space: nowrap; }
        .size-80x25 .text { padding-left: 2mm; justify-content: center; gap: 0.6mm; }
        .size-80x25 .scan { font-size: 2.1mm; color: #333; }
        @media print {
          .bar { display: none; }
          .labels { padding: 0; gap: 0; }
          .label { outline: none; }
          .sheet:not(.size-a4) .label { break-after: page; page-break-after: always; }
          .sheet:not(.size-a4) .label:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div className="bar">
        {LABEL_SIZES.map((s) => (
          <button key={s.id} type="button" className={`opt ${size === s.id ? "on" : ""}`} onClick={() => pick(s.id)}><b>{s.name}</b><span>{s.hint}</span></button>
        ))}
        <button type="button" className="print" onClick={() => window.print()}>{ready ? "พิมพ์อีกครั้ง" : "พิมพ์"}</button>
        <span className="tip">{labels.length} ฉลาก · ตั้งค่าเครื่องพิมพ์: ขนาดกระดาษ = {sheet ? "A4" : LABEL_SIZES.find((s) => s.id === size)?.name}, ระยะขอบ 0 (ไม่มี), สเกล 100% (ไม่ย่อ/ขยาย)</span>
      </div>
      {labels.length === 0 ? <p style={{ padding: 24 }}>ไม่พบรายการที่จะพิมพ์</p> : null}
      <div className="labels">
        {labels.map((l) => (
          size === "80x25" ? (
            <div className="label" key={l.id}>
              <div className="band"><span>Corta</span></div>
              <div className="text">
                <p className="product">{l.product}</p>
                <p className="meta">{l.farm} · {l.place} · {l.cut}</p>
                <p className="lot">{l.id}</p>
                <p className="scan">สแกนดูที่มาสินค้า</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="qr"><img src={l.qr} alt={`QR ${l.id}`} /></div>
            </div>
          ) : (
            <div className="label" key={l.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="qr"><img src={l.qr} alt={`QR ${l.id}`} /></div>
              <div className="text">
                <p className="brand">Corta</p>
                <div style={{ minWidth: 0 }}>
                  <p className="product" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.product}</p>
                  <p className="meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{size === "40x25" ? l.qty : `${l.qty} · ${l.cut}`}</p>
                  <p className="meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.farm}</p>
                </div>
                <p className="lot">{l.id}</p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
