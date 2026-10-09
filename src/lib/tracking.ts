// Tracking links (Thai Post doc 9 Oct 2026 §9). Parcel carriers use their own tracking number;
// air cargo is tracked by the Air Waybill (AWB, 11 digits "XXX-XXXXXXXX") — its first 3 digits
// are the airline's cargo prefix, which picks the airline's tracking page.

export interface AwbAirline { prefix: string; name: string; url: string }
export const AWB_AIRLINES: AwbAirline[] = [
  { prefix: "232", name: "การบินไทย (Thai Cargo)", url: "https://www.thaicargo.com/" },
  { prefix: "176", name: "Emirates SkyCargo", url: "https://www.skycargo.com/" },
  { prefix: "157", name: "Qatar Airways Cargo", url: "https://www.qrcargo.com/" },
  { prefix: "160", name: "Cathay Cargo", url: "https://www.cathaycargo.com/" },
  { prefix: "695", name: "EVA Air Cargo", url: "https://www.brcargo.com/" },
  { prefix: "618", name: "Singapore Airlines Cargo", url: "https://www.siacargo.com/" },
];

/** "23212345678" / "232-12345678" → "232-12345678"; anything else → null. */
export function normalizeAwb(v?: string | null): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3)}` : null;
}
export const awbAirline = (awb?: string | null) => AWB_AIRLINES.find((a) => a.prefix === normalizeAwb(awb)?.slice(0, 3));

/** Where to check an AWB: the airline's cargo tracking page (else a multi-airline tracker). */
export function awbUrl(awb?: string | null): string | null {
  const n = normalizeAwb(awb);
  if (!n) return null;
  return awbAirline(n)?.url ?? `https://www.track-trace.com/aircargo#${n.replace("-", "")}`;
}

/** Parcel tracking page for a round's carrier text + tracking number (carriers with a stable deep link only). */
export function parcelTrackingUrl(carrier: string | undefined, trackingNo?: string | null): string | null {
  const t = (trackingNo ?? "").trim();
  if (!t) return null;
  const c = (carrier ?? "").toLowerCase();
  if (/ไปรษณีย์|thai ?post|ปณ/.test(c) || /^[A-Z]{2}\d{9}TH$/i.test(t)) return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(t)}`;
  if (/dhl/.test(c)) return `https://www.dhl.com/th-th/home/tracking.html?tracking-id=${encodeURIComponent(t)}`;
  return null;
}
