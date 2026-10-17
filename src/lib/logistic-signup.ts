// Shared checks for the two logistic sign-up forms (company / branch) — doc tab "Logistic", 17 Oct 2026.
// Server side: the client checks the same things first, the server never trusts it.
import { placeOf } from "./places";
import { parseLatLng } from "./latlng";
import { asCarrierKey } from "./carriers";
import type { CarrierKey } from "./types";
import { PASSWORD_RULE, passwordOk, phoneOk, emailOk } from "./signup-rules";

export interface SignupPlace {
  phone: string;
  address: string;
  province: string;
  district: string;
  subdistrict: string;
  postcode: string;
  lat: number;
  lng: number;
}
export interface SignupAdmin { username: string; email: string; password: string }

type Errors = Record<string, string>;
const str = (b: Record<string, unknown>, k: string) => (b[k] != null ? String(b[k]).trim() : "");

/** Phone + address + ตำบล (checked against the list; the postcode comes from it) + GPS. */
export function checkPlace(b: Record<string, unknown>, e: Errors): SignupPlace {
  const phone = str(b, "phone").replace(/[\s-]/g, "");
  if (!phone) e.phone = "กรุณากรอกหมายเลขโทรศัพท์";
  else if (!phoneOk(phone)) e.phone = "หมายเลขโทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก";
  const address = str(b, "address");
  if (!address) e.address = "กรุณากรอกที่อยู่";
  const province = str(b, "province"), district = str(b, "district"), subdistrict = str(b, "subdistrict");
  if (!province) e.province = "กรุณาเลือกจังหวัด";
  if (!district) e.district = "กรุณาเลือกอำเภอ/เขต";
  if (!subdistrict) e.subdistrict = "กรุณาเลือกตำบล/แขวง";
  const place = placeOf(province, district, subdistrict);
  if (province && district && subdistrict && !place) e.subdistrict = "ไม่พบตำบล/แขวงนี้ในอำเภอที่เลือก";
  const gps = parseLatLng(str(b, "gps"));
  if (!str(b, "gps")) e.gps = "กรุณาระบุพิกัดที่ตั้ง";
  else if (!gps) e.gps = "รูปแบบพิกัดไม่ถูกต้อง (ละติจูด, ลองจิจูด)";
  else if (gps.lat < 5 || gps.lat > 21 || gps.lng < 97 || gps.lng > 106) e.gps = "พิกัดนี้อยู่นอกประเทศไทย";
  return { phone, address, province, district, subdistrict, postcode: place?.postcode ?? "", lat: gps?.lat ?? 0, lng: gps?.lng ?? 0 };
}

export function checkAdmin(b: Record<string, unknown>, e: Errors): SignupAdmin {
  const username = str(b, "username"), email = str(b, "email");
  const password = String(b.password ?? ""), confirm = String(b.confirmPassword ?? "");
  if (!username) e.username = "กรุณากรอกชื่อผู้ใช้งาน";
  if (!email) e.email = "กรุณากรอกอีเมล";
  else if (!emailOk(email)) e.email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (!password) e.password = "กรุณากำหนดรหัสผ่าน";
  else if (!passwordOk(password)) e.password = PASSWORD_RULE;
  if (!confirm) e.confirmPassword = "กรุณายืนยันรหัสผ่าน";
  else if (password !== confirm) e.confirmPassword = "รหัสผ่านไม่ตรงกัน";
  if (b.accept !== true) e.accept = "กรุณายอมรับข้อกำหนดและนโยบายคุ้มครองข้อมูลส่วนบุคคล";
  return { username, email, password };
}

export function checkCompany(b: Record<string, unknown>, e: Errors): { company: string; providerType: CarrierKey; taxId?: string } {
  const company = str(b, "company");
  if (!company) e.company = "กรุณากรอกชื่อบริษัท";
  const providerType = asCarrierKey(str(b, "providerType"));
  if (!providerType) e.providerType = "กรุณาเลือกประเภทผู้ให้บริการขนส่ง";
  const taxId = str(b, "taxId").replace(/[\s-]/g, "");
  if (taxId && !/^\d{13}$/.test(taxId)) e.taxId = "เลขประจำตัวผู้เสียภาษีอากรต้องมี 13 หลัก";
  return { company, providerType: providerType ?? "private", taxId: taxId || undefined };
}

/** The first error, for the API's one-line message. */
export const firstError = (e: Errors) => Object.values(e)[0];
