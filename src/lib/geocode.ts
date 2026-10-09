// Server-side geocoding of a recipient address (Thai Post doc 9 Oct 2026: the transport distance is
// [ที่อยู่ปลายทาง (ผู้รับ) − สาขาต้นทาง], not the destination province).
// OpenStreetMap Nominatim cannot place a full Thai street address, but it does place
// ตำบล/แขวง + อำเภอ/เขต + จังหวัด and postcodes — so the address is broken into those parts and
// tried from the most to the least precise. Results are cached in `geocode_cache` (Nominatim's
// usage policy: identify the app, ≤1 request/s, cache what you can).
import { sql } from "drizzle-orm";
import { db } from "./db";
import { DESTINATIONS } from "./geo";

export type GeoPrecision = "subdistrict" | "postcode" | "district" | "province";
export interface GeoPoint { lat: number; lng: number; precision: GeoPrecision; label: string }

const UA = "Corta/1.0 (https://corta.tech; carbon traceability for Thai farms)";

/** Pull ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ out of a free-text Thai address. */
export function addressParts(address: string) {
  const a = address.replace(/\s+/g, " ").trim();
  const word = "([฀-๿A-Za-z]+)";
  const pick = (re: RegExp) => re.exec(a)?.[1] ?? "";
  const subdistrict = pick(new RegExp(`(?:ต\\.|ตำบล|แขวง)\\s*${word}`));
  let district = pick(new RegExp(`(?:อ\\.|อำเภอ|เขต)\\s*${word}`));
  let province = pick(new RegExp(`(?:จ\\.|จังหวัด)\\s*${word}`));
  if (!province) {
    if (/กรุงเทพ|กทม/.test(a)) province = "กรุงเทพมหานคร";
    else province = DESTINATIONS.find((d) => a.includes(d.province))?.province ?? "";
  }
  if (province === "กรุงเทพฯ" || province === "กทม") province = "กรุงเทพมหานคร";
  if (district === "เมือง" && province) district = `เมือง${province}`;
  const postcode = /\b(\d{5})\b/.exec(a)?.[1] ?? "";
  return { subdistrict, district, province, postcode };
}

async function nominatim(params: Record<string, string>): Promise<{ lat: number; lng: number; label: string } | null> {
  const qs = new URLSearchParams({ format: "json", limit: "1", "accept-language": "th", ...params });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { lat: string; lon: string; display_name: string }[];
    return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon), label: j[0].display_name } : null;
  } catch {
    return null;
  }
}

async function cached(key: string): Promise<GeoPoint | null | undefined> {
  const rows = await db.execute(sql`SELECT lat, lng, precision, label FROM geocode_cache WHERE q = ${key} LIMIT 1`);
  const r = ((rows as unknown as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[]))[0];
  if (!r) return undefined;
  return r.lat == null ? null : { lat: Number(r.lat), lng: Number(r.lng), precision: r.precision as GeoPrecision, label: String(r.label ?? "") };
}

async function remember(key: string, p: GeoPoint | null) {
  await db.execute(sql`INSERT INTO geocode_cache (q, lat, lng, precision, label, created_at)
    VALUES (${key}, ${p?.lat ?? null}, ${p?.lng ?? null}, ${p?.precision ?? null}, ${p?.label ?? null}, ${new Date().toISOString()})
    ON CONFLICT (q) DO NOTHING`);
}

/** Best point for an address, most precise first; province centre as the last resort. */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = address.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 300);
  if (!key) return null;
  const hit = await cached(key);
  if (hit !== undefined) return hit;

  const { subdistrict, district, province, postcode } = addressParts(address);
  let found: GeoPoint | null = null;
  // Nominatim matches administrative names far better with their Thai prefixes; Bangkok uses แขวง/เขต.
  const bkk = province === "กรุงเทพมหานคร";
  const prov = province ? (bkk ? "กรุงเทพมหานคร" : `จังหวัด${province}`) : "";
  const dist = district ? `${bkk ? "เขต" : "อำเภอ"}${district}` : "";
  const sub = subdistrict ? `${bkk ? "แขวง" : "ตำบล"}${subdistrict}` : "";
  const tries: [GeoPrecision, Record<string, string>][] = [];
  if (sub && (dist || prov)) tries.push(["subdistrict", { q: [sub, dist, prov].filter(Boolean).join(" "), countrycodes: "th" }]);
  if (postcode) tries.push(["postcode", { postalcode: postcode, country: "th" }]);
  if (dist && prov) tries.push(["district", { q: `${dist} ${prov}`, countrycodes: "th" }]);
  // a hit outside the address's province is a false match (e.g. a shop named after the district)
  const inProvince = (label: string) => !province || label.includes(province) || (bkk && label.includes("กรุงเทพ"));
  for (const [precision, params] of tries) {
    const r = await nominatim(params);
    if (r && inProvince(r.label)) { found = { ...r, precision }; break; }
  }
  if (!found && province) {
    const d = DESTINATIONS.find((x) => x.province === province || x.name === province);
    if (d) found = { lat: d.lat, lng: d.lng, precision: "province", label: d.province };
  }
  await remember(key, found);
  return found;
}
