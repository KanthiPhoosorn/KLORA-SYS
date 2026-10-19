"use client";

import { useEffect, useState } from "react";
import { DESTINATIONS, haversineKm } from "./geo";
import { parseLatLng, isShortMapsLink } from "./latlng";

export { parseLatLng, isShortMapsLink };

// Transport distance for the round forms (Thai Post doc 9 Oct 2026):
//   distance = [ที่อยู่ปลายทาง (ผู้รับ) − สาขาต้นทาง] × 1.3 road factor
// Recipient point, most precise first: the GPS pin → the geocoded address (/api/geocode, debounced).
// 13 Oct 2026 (doc: "ตอนนี้มันเหมือนคำนวณจากจังหวัด"): nothing is computed from the province alone any
// more — the form waits for the recipient address; the province centre is used only when that address
// cannot be placed (or the lookup failed), and then the result is flagged `approx` so the form can ask for a pin.
export type DestPrecision = "gps" | "subdistrict" | "postcode" | "district" | "province";
const PRECISION_LABEL: Record<DestPrecision, string> = {
  gps: "พิกัดผู้รับ",
  subdistrict: "ที่อยู่ผู้รับ (ระดับตำบล)",
  postcode: "ที่อยู่ผู้รับ (ระดับรหัสไปรษณีย์)",
  district: "ที่อยู่ผู้รับ (ระดับอำเภอ)",
  province: "จังหวัดปลายทาง (ประมาณ หาที่อยู่ไม่พบ)",
};
const ROAD_FACTOR = 1.3;
type Point = { lat: number; lng: number; precision: DestPrecision };

export interface RecipientDistance {
  km: number | null;
  basis: string;
  /** the address is being looked up (also during the typing pause) */
  looking: boolean;
  /** placed at province level only */
  approx: boolean;
  /** no recipient address (or pin) yet */
  needAddress: boolean;
  /** the address could not be placed and there is no province to fall back on */
  notFound: boolean;
}

export function useRecipientDistance(
  origin: { lat: number; lng: number; label: string } | null,
  address: string,
  gps: { lat: number; lng: number } | null,
  province: string,
): RecipientDistance {
  // the last lookup: which address it was for, and what it found (null = not found, or the lookup failed)
  const [geo, setGeo] = useState<{ forAddress: string; point: Point | null } | null>(null);
  const addr = address.trim();
  useEffect(() => {
    if (gps || addr.length < 8) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      let point: Point | null = null;
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}`, { signal: ctl.signal });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.point) point = { lat: j.point.lat, lng: j.point.lng, precision: j.point.precision };
      } catch {
        if (ctl.signal.aborted) return; // the address changed — a newer lookup is on its way
      }
      setGeo({ forAddress: addr, point });
    }, 700);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [addr, gps]);

  const needAddress = !gps && addr.length < 8;
  const lookup = geo && geo.forAddress === addr ? geo : null;
  const looking = !gps && !needAddress && !lookup;
  const prov = DESTINATIONS.find((d) => d.name === province || d.province === province);
  const dest: Point | null = gps
    ? { ...gps, precision: "gps" }
    : needAddress || !lookup
      ? null // no address yet, or still looking it up
      : lookup.point ?? (prov ? { lat: prov.lat, lng: prov.lng, precision: "province" } : null);
  const notFound = !gps && !!lookup && !lookup.point && !prov;
  if (!origin || !dest) return { km: null, basis: "", looking, approx: false, needAddress, notFound };
  return {
    km: Math.max(1, Math.round(haversineKm(origin.lat, origin.lng, dest.lat, dest.lng) * ROAD_FACTOR)),
    basis: `คำนวณจาก ${origin.label} → ${PRECISION_LABEL[dest.precision]}`,
    looking,
    approx: dest.precision === "province",
    needAddress,
    notFound,
  };
}

/** A maps.app.goo.gl share link → its point (the server follows the redirect); null if it has none. */
export async function resolveMapsLink(link: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(`/api/geocode?link=${encodeURIComponent(link.trim())}`);
    const j = await r.json().catch(() => ({}));
    return r.ok && j.point ? { lat: j.point.lat, lng: j.point.lng } : null;
  } catch {
    return null;
  }
}
