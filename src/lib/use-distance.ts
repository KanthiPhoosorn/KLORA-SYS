"use client";

import { useEffect, useState } from "react";
import { DESTINATIONS, haversineKm } from "./geo";

// Transport distance for the round forms (Thai Post doc 9 Oct 2026):
//   distance = [ที่อยู่ปลายทาง (ผู้รับ) − สาขาต้นทาง] × 1.3 road factor
// Recipient point, most precise first: the GPS pin → the geocoded address (/api/geocode, debounced)
// → the destination province's centre. Origin: the chosen origin branch, else the farm.
export type DestPrecision = "gps" | "subdistrict" | "postcode" | "district" | "province";
const PRECISION_LABEL: Record<DestPrecision, string> = {
  gps: "พิกัดผู้รับ",
  subdistrict: "ที่อยู่ผู้รับ (ระดับตำบล)",
  postcode: "ที่อยู่ผู้รับ (ระดับรหัสไปรษณีย์)",
  district: "ที่อยู่ผู้รับ (ระดับอำเภอ)",
  province: "จังหวัดปลายทาง (ประมาณ)",
};
const ROAD_FACTOR = 1.3;

export function useRecipientDistance(
  origin: { lat: number; lng: number; label: string } | null,
  address: string,
  gps: { lat: number; lng: number } | null,
  province: string,
): { km: number | null; basis: string; looking: boolean } {
  const [geo, setGeo] = useState<{ lat: number; lng: number; precision: DestPrecision; forAddress: string } | null>(null);
  const [looking, setLooking] = useState(false);
  const addr = address.trim();
  useEffect(() => {
    if (gps || addr.length < 8) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLooking(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}`, { signal: ctl.signal });
        const j = await r.json().catch(() => ({}));
        setGeo(j.point ? { lat: j.point.lat, lng: j.point.lng, precision: j.point.precision, forAddress: addr } : null);
      } catch { /* aborted / offline → fall back to the province */ }
      setLooking(false);
    }, 700);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [addr, gps]);

  const prov = DESTINATIONS.find((d) => d.name === province || d.province === province);
  const geoHit = geo && geo.forAddress === addr ? geo : null;
  const dest = gps
    ? { ...gps, precision: "gps" as const }
    : geoHit ?? (prov ? { lat: prov.lat, lng: prov.lng, precision: "province" as const } : null);
  if (!origin || !dest) return { km: null, basis: "", looking };
  return {
    km: Math.max(1, Math.round(haversineKm(origin.lat, origin.lng, dest.lat, dest.lng) * ROAD_FACTOR)),
    basis: `คำนวณจาก ${origin.label} → ${PRECISION_LABEL[dest.precision]}`,
    looking,
  };
}
