// Thai administrative places for the address pickers (จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์), from the
// offline list in tambon-data.json (CC BY 4.0, data/master/tambon/README.md). Server only — the forms ask
// /api/places one level at a time.
import data from "./tambon-data.json";

type Compact = { p: string[]; d: [string, number, number | null, number | null][]; s: [string, number, number, number, string][] };
const { p: PROV, d: DIST, s: SUB } = data as unknown as Compact;

/** The six regions (ภาค) — provinces are listed region by region */
export const REGIONS: { name: string; provinces: string[] }[] = [
  { name: "ภาคเหนือ", provinces: ["เชียงราย", "เชียงใหม่", "น่าน", "พะเยา", "แพร่", "แม่ฮ่องสอน", "ลำปาง", "ลำพูน", "อุตรดิตถ์"] },
  { name: "ภาคตะวันออกเฉียงเหนือ", provinces: ["กาฬสินธุ์", "ขอนแก่น", "ชัยภูมิ", "นครพนม", "นครราชสีมา", "บึงกาฬ", "บุรีรัมย์", "มหาสารคาม", "มุกดาหาร", "ยโสธร", "ร้อยเอ็ด", "เลย", "ศรีสะเกษ", "สกลนคร", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อำนาจเจริญ", "อุดรธานี", "อุบลราชธานี"] },
  { name: "ภาคกลาง", provinces: ["กรุงเทพมหานคร", "กำแพงเพชร", "ชัยนาท", "นครนายก", "นครปฐม", "นครสวรรค์", "นนทบุรี", "ปทุมธานี", "พระนครศรีอยุธยา", "พิจิตร", "พิษณุโลก", "เพชรบูรณ์", "ลพบุรี", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สระบุรี", "อ่างทอง", "อุทัยธานี"] },
  { name: "ภาคตะวันออก", provinces: ["จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ตราด", "ปราจีนบุรี", "ระยอง", "สระแก้ว"] },
  { name: "ภาคตะวันตก", provinces: ["กาญจนบุรี", "ตาก", "ประจวบคีรีขันธ์", "เพชรบุรี", "ราชบุรี"] },
  { name: "ภาคใต้", provinces: ["กระบี่", "ชุมพร", "ตรัง", "นครศรีธรรมราช", "นราธิวาส", "ปัตตานี", "พังงา", "พัทลุง", "ภูเก็ต", "ยะลา", "ระนอง", "สงขลา", "สตูล", "สุราษฎร์ธานี"] },
];
const th = (a: string, b: string) => a.localeCompare(b, "th");

/** Every province, by region (provinces sorted in Thai order within a region). Any province the list
 *  knows but the region table does not (none today) goes under "อื่นๆ". */
export function provincesByRegion(): { name: string; provinces: string[] }[] {
  const known = new Set(REGIONS.flatMap((r) => r.provinces));
  const out = REGIONS.map((r) => ({ name: r.name, provinces: r.provinces.filter((p) => PROV.includes(p)).sort(th) }));
  const rest = PROV.filter((p) => !known.has(p));
  return rest.length ? [...out, { name: "อื่นๆ", provinces: rest.sort(th) }] : out;
}

export function districtsOf(province: string): string[] {
  const pi = PROV.indexOf(province);
  if (pi < 0) return [];
  return DIST.filter((d) => d[1] === pi).map((d) => d[0]).sort(th);
}

export interface SubdistrictPlace { name: string; postcode: string; lat: number; lng: number }
export function subdistrictsOf(province: string, district: string): SubdistrictPlace[] {
  const pi = PROV.indexOf(province);
  const di = DIST.findIndex((d) => d[1] === pi && d[0] === district);
  if (di < 0) return [];
  return SUB.filter((s) => s[1] === di).map(([name, , lat, lng, postcode]) => ({ name, postcode, lat, lng })).sort((a, b) => th(a.name, b.name));
}

/** A picked place, checked against the list — the server never trusts the form's postcode. */
export function placeOf(province?: string, district?: string, subdistrict?: string): SubdistrictPlace | null {
  if (!province || !district || !subdistrict) return null;
  return subdistrictsOf(province, district).find((s) => s.name === subdistrict) ?? null;
}
