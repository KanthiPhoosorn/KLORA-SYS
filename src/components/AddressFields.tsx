"use client";

import { useEffect, useState } from "react";
import { Crosshair, LocateFixed, X } from "lucide-react";
import TileMap from "@/components/TileMap";
import { parseLatLng } from "@/lib/latlng";

// Address block of the logistic sign-up forms (doc "Logistic", 17 Oct 2026): street address, จังหวัด (by
// ภาค) → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ shown by the system (KYN's รหัสไปรษณีย์ (แยกภาค) sheet), and พิกัดที่ตั้ง typed or picked on a map.
export interface AddressValue { address: string; province: string; district: string; subdistrict: string; postcode: string; gps: string }
export const EMPTY_ADDRESS: AddressValue = { address: "", province: "", district: "", subdistrict: "", postcode: "", gps: "" };
type Sub = { name: string; postcode: string; lat: number | null; lng: number | null };

export default function AddressFields({ value, onChange, errs, clearErr, addressLabel, addressPlaceholder = "บ้านเลขที่ หมู่ ซอย ถนน", gpsPlaceholder, gpsHint, inputCls, labelCls, req }: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  errs: Record<string, string | undefined>;
  clearErr: (k: string) => void;
  addressLabel: string;
  addressPlaceholder?: string;
  gpsPlaceholder: string;
  gpsHint: string;
  inputCls: (bad: boolean) => string;
  labelCls: string;
  req: React.ReactNode;
}) {
  const [regions, setRegions] = useState<{ name: string; provinces: string[] }[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [picking, setPicking] = useState(false);
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  useEffect(() => { fetch("/api/places").then((r) => r.json()).then((j) => setRegions(j.regions ?? [])).catch(() => setRegions([])); }, []);
  useEffect(() => {
    setDistricts([]);
    if (!value.province) return;
    let current = true;
    fetch(`/api/places?province=${encodeURIComponent(value.province)}`).then((r) => r.json()).then((j) => { if (current) setDistricts(j.districts ?? []); }).catch(() => {});
    return () => { current = false; };
  }, [value.province]);
  useEffect(() => {
    setSubs([]);
    if (!value.province || !value.district) return;
    let current = true;
    fetch(`/api/places?province=${encodeURIComponent(value.province)}&district=${encodeURIComponent(value.district)}`).then((r) => r.json()).then((j) => { if (current) setSubs(j.subdistricts ?? []); }).catch(() => {});
    return () => { current = false; };
  }, [value.province, value.district]);

  const sub = subs.find((s) => s.name === value.subdistrict);
  const pin = parseLatLng(value.gps);
  const selectCls = (bad: boolean) => `${inputCls(bad)} appearance-auto`;

  return (
    <>
      <div>
        <label className={labelCls}>{addressLabel}{req}</label>
        <input name="address" value={value.address} onChange={(e) => { set({ address: e.target.value }); clearErr("address"); }} placeholder={addressPlaceholder} className={inputCls(!!errs.address)} />
        <Err msg={errs.address} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>จังหวัด{req}</label>
          <select name="province" value={value.province} onChange={(e) => { set({ province: e.target.value, district: "", subdistrict: "", postcode: "" }); clearErr("province"); }} className={selectCls(!!errs.province)}>
            <option value="">กรุณาเลือกจังหวัด</option>
            {regions.map((r) => (
              <optgroup key={r.name} label={r.name}>
                {r.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            ))}
          </select>
          <Err msg={errs.province} />
        </div>
        <div>
          <label className={labelCls}>อำเภอ/เขต{req}</label>
          <select name="district" value={value.district} disabled={!value.province} onChange={(e) => { set({ district: e.target.value, subdistrict: "", postcode: "" }); clearErr("district"); }} className={selectCls(!!errs.district)}>
            <option value="">กรุณาเลือกอำเภอ/เขต</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <Err msg={errs.district} />
        </div>
        <div>
          <label className={labelCls}>ตำบล/แขวง{req}</label>
          <select name="subdistrict" value={value.subdistrict} disabled={!value.district} onChange={(e) => { const s = subs.find((x) => x.name === e.target.value); set({ subdistrict: e.target.value, postcode: s?.postcode ?? "" }); clearErr("subdistrict"); }} className={selectCls(!!errs.subdistrict)}>
            <option value="">กรุณาเลือกตำบล/แขวง</option>
            {subs.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <Err msg={errs.subdistrict} />
        </div>
        <div>
          <label className={labelCls}>รหัสไปรษณีย์</label>
          <input name="postcode" value={value.postcode} readOnly tabIndex={-1} placeholder="ระบบแสดงอัตโนมัติ" className={`${inputCls(false)} cursor-default bg-slate-100 text-slate-700`} />
        </div>
      </div>
      <div>
        <label className={labelCls}>พิกัดที่ตั้ง{req}</label>
        <div className="flex gap-2">
          <input name="gps" value={value.gps} onChange={(e) => { const p = /https?:/.test(e.target.value) ? parseLatLng(e.target.value) : null; set({ gps: p ? `${p.lat}, ${p.lng}` : e.target.value }); clearErr("gps"); }} placeholder={gpsPlaceholder} className={`${inputCls(!!errs.gps)} min-w-0 flex-1`} />
          <button type="button" onClick={() => setPicking(true)} title="เลือกตำแหน่งจากแผนที่" aria-label="เลือกตำแหน่งจากแผนที่" className="grid size-[44px] shrink-0 place-items-center rounded-[8px] border border-gray-300 text-slate-500 hover:bg-gray-50">
            <Crosshair size={17} />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{gpsHint}</p>
        <Err msg={errs.gps} />
      </div>
      {picking ? (
        <MapPicker
          start={pin ?? (sub?.lat != null && sub.lng != null ? { lat: sub.lat, lng: sub.lng } : null)}
          onClose={() => setPicking(false)}
          onPick={(p) => { set({ gps: `${p.lat}, ${p.lng}` }); clearErr("gps"); setPicking(false); }}
        />
      ) : null}
    </>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[12px] text-[#ee443f]">{msg}</p> : null;
}

/** Pick a point: opens at the typed pin, else the chosen ตำบล, else Thailand. */
function MapPicker({ start, onPick, onClose }: { start: { lat: number; lng: number } | null; onPick: (p: { lat: number; lng: number }) => void; onClose: () => void }) {
  const [p, setP] = useState(start);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const here = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setP({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5 }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const view = p ?? { lat: 13.7563, lng: 100.5018 };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="เลือกตำแหน่งจากแผนที่" onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[16px] font-bold text-slate-900">เลือกตำแหน่งจากแผนที่</p>
          <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <p className="mb-2 text-[12.5px] text-slate-500">แตะบนแผนที่เพื่อปักหมุดตำแหน่งที่ตั้ง ลากเพื่อเลื่อนแผนที่</p>
        <TileMap lat={view.lat} lng={view.lng} pin={!!p} zoom={p ? 15 : 6} height={320} onPick={(lat, lng) => setP({ lat, lng })} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={here} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
            <LocateFixed size={15} /> {locating ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
          </button>
          <span className="text-[12.5px] tabular-nums text-slate-500">{p ? `${p.lat}, ${p.lng}` : "ยังไม่ได้ปักหมุด"}</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">ยกเลิก</button>
            <button type="button" disabled={!p} onClick={() => p && onPick(p)} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">ใช้ตำแหน่งนี้</button>
          </div>
        </div>
      </div>
    </div>
  );
}
