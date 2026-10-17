"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";

// A small slippy map on OpenStreetMap tiles — no library. Shows a pin; with `onPick`, a tap/click sets it
// and dragging pans. Used to pick a branch's พิกัดที่ตั้ง and to show it when the head office reviews a
// branch (doc "Logistic", 17 Oct 2026). Tiles: © OpenStreetMap contributors (light, interactive use).
const T = 256;
const worldPx = (z: number) => T * 2 ** z;
const toPx = (lat: number, lng: number, z: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * worldPx(z), y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldPx(z) };
};
const toLatLng = (x: number, y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / worldPx(z);
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (x / worldPx(z)) * 360 - 180 };
};
const round = (v: number) => Math.round(v * 1e5) / 1e5;

export default function TileMap({ lat, lng, pin = true, zoom: z0 = 14, height = 240, onPick, caption }: {
  /** the pin (and where the map opens) */
  lat: number; lng: number;
  pin?: boolean;
  zoom?: number;
  height?: number;
  /** tap/click → new pin position */
  onPick?: (lat: number, lng: number) => void;
  caption?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [z, setZ] = useState(z0);
  const [center, setCenter] = useState(() => toPx(lat, lng, z0));
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // a new pin from outside (typed coordinates, current location) re-centres the map
  useEffect(() => { setCenter(toPx(lat, lng, z)); }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = center.x - w / 2, top = center.y - height / 2;
  const n = 2 ** z;
  const tiles: { key: string; src: string; x: number; y: number }[] = [];
  if (w) {
    for (let ty = Math.floor(top / T); ty <= Math.floor((top + height) / T); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(left / T); tx <= Math.floor((left + w) / T); tx++) {
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${z}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`, x: tx * T - left, y: ty * T - top });
      }
    }
  }
  const p = toPx(lat, lng, z);

  function zoomTo(nz: number) {
    const c = toLatLng(center.x, center.y, z);
    const zz = Math.max(5, Math.min(18, nz));
    setZ(zz);
    setCenter(toPx(c.lat, c.lng, zz));
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" style={{ height }}>
      <div
        ref={box}
        className={`absolute inset-0 touch-none select-none ${onPick ? "cursor-crosshair" : "cursor-grab"}`}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (d.moved) setCenter({ x: d.cx - dx, y: d.cy - dy });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.moved || !onPick || !box.current) return;
          const r = box.current.getBoundingClientRect();
          const ll = toLatLng(left + (e.clientX - r.left), top + (e.clientY - r.top), z);
          onPick(round(ll.lat), round(((ll.lng + 540) % 360) - 180));
        }}
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.key} src={t.src} alt="" draggable={false} className="pointer-events-none absolute size-64 max-w-none" style={{ left: t.x, top: t.y, width: T, height: T }} />
        ))}
        {pin ? (
          <svg aria-hidden className="pointer-events-none absolute drop-shadow" width="30" height="40" viewBox="0 0 30 40" style={{ left: p.x - left - 15, top: p.y - top - 38 }}>
            <path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 40 15 40s15-14.1 15-25.2C30 6.6 23.3 0 15 0z" fill="#dc2626" />
            <circle cx="15" cy="14.5" r="5.5" fill="#fff" />
          </svg>
        ) : null}
      </div>
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg bg-white shadow ring-1 ring-slate-200">
        <button type="button" aria-label="ซูมเข้า" onClick={() => zoomTo(z + 1)} className="grid size-8 place-items-center text-slate-600 hover:bg-slate-50"><Plus size={16} /></button>
        <button type="button" aria-label="ซูมออก" onClick={() => zoomTo(z - 1)} className="grid size-8 place-items-center border-t border-slate-200 text-slate-600 hover:bg-slate-50"><Minus size={16} /></button>
      </div>
      {caption ? <span className="absolute bottom-6 right-2 rounded-md bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow-sm">{caption}</span> : null}
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-slate-500">© OpenStreetMap</span>
    </div>
  );
}
