// Thai administrative places for the address pickers (ภาค → จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์),
// from KYN's "รหัสไปรษณีย์ (แยกภาค)" sheet (data/master/postcodes, 18 Oct 2026) built into places-data.json by
// scripts/gen-places.mjs. Server only — the forms ask /api/places one level at a time.
import data from "./places-data.json";

type Compact = { r: [string, number[]][]; p: string[]; d: [string, number][]; s: [string, number, string, number | null, number | null][] };
const { r: REG, p: PROV, d: DIST, s: SUB } = data as unknown as Compact;
const th = (a: string, b: string) => a.localeCompare(b, "th");

/** The six regions (ภาค) as the sheet's tabs group them, provinces in Thai order */
export const REGIONS: { name: string; provinces: string[] }[] = REG.map(([name, ps]) => ({ name, provinces: ps.map((i) => PROV[i]) }));
export const provincesByRegion = () => REGIONS;

export function districtsOf(province: string): string[] {
  const pi = PROV.indexOf(province);
  if (pi < 0) return [];
  return DIST.filter((d) => d[1] === pi).map((d) => d[0]).sort(th);
}

/** A ตำบล with its postcode, and roughly where it is (for opening the map picker there) */
export interface SubdistrictPlace { name: string; postcode: string; lat: number | null; lng: number | null }
export function subdistrictsOf(province: string, district: string): SubdistrictPlace[] {
  const pi = PROV.indexOf(province);
  const di = DIST.findIndex((d) => d[1] === pi && d[0] === district);
  if (di < 0) return [];
  return SUB.filter((s) => s[1] === di).map(([name, , postcode, lat, lng]) => ({ name, postcode, lat, lng })).sort((a, b) => th(a.name, b.name));
}

/** A picked place, checked against the sheet — the server never trusts the form's postcode. */
export function placeOf(province?: string, district?: string, subdistrict?: string): SubdistrictPlace | null {
  if (!province || !district || !subdistrict) return null;
  return subdistrictsOf(province, district).find((s) => s.name === subdistrict) ?? null;
}
