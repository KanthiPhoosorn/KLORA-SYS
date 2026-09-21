// KLORA domain types.
// SUP = Supplier (ผู้ผลิต/ฟาร์ม). Batch = a shipment of cut flowers logged each cutting round.

export type SupplierStatus = "active" | "suspended"; // ใช้งาน / ระงับ

// หนึ่งชนิดดอกไม้ + พันธุ์ที่ปลูกภายใต้ชนิดนั้น (ฟอร์มสมัครเลือกได้หลายกลุ่ม)
// ชนิด + พันธุ์ที่ปลูก 1 กลุ่ม (category ว่าง = ดอกไม้ สำหรับข้อมูลเก่า)
export interface FlowerTypeEntry {
  category?: ProductCategory;
  type: string;
  varieties: string[];
}

export interface Supplier {
  id: string; // SUP-YYYY-NNNN — issued by the system

  // --- ข้อมูลพื้นฐานบังคับ (mandatory profile) ---
  farmName: string; // ชื่อฟาร์ม
  address: string; // ที่อยู่
  province?: string; // จังหวัด — derived from address at register (KYN table + reports)
  gpsLat: number; // พิกัด GPS
  gpsLng: number;
  owner: string; // เจ้าของฟาร์ม
  flowerType: string; // ประเภทดอกไม้
  highlights: string; // จุดเด่นฟาร์ม
  contact: string; // ช่องทางติดต่อ

  // --- ข้อมูลพื้นฐานไม่บังคับ / ใช้คำนวณ (optional, set once) ---
  // Basket reuse is now tracked per-round (Batch.basketIds) and counted automatically —
  // it no longer lives on the farm profile.
  fuelLitres?: number; // Fuel — litres of diesel per cutting round
  electricityKwh?: number; // Electricity — kWh per cutting round
  fertilizerKg?: number; // Fertilizer — kg per cutting round
  agriChemicalsKg?: number; // สารเคมีทางการเกษตร (kg/เดือน)
  waterM3?: number; // ปริมาณน้ำ (ลบ.ม./เดือน)
  wasteKg?: number; // ปริมาณของเสีย (kg/เดือน)
  flowersPerMonth?: number; // จำนวนดอกที่ปลูกต่อเดือน

  // --- extended producer profile (from multi-step register) ---
  contactName?: string; // ชื่อผู้ติดต่อ
  phone?: string; // เบอร์โทร
  lineId?: string; // Line ID
  varieties?: string[]; // พันธุ์ดอกไม้ที่ปลูก (แบนราบ — รวมทุกชนิด)
  flowerTypes?: FlowerTypeEntry[]; // ชนิด+พันธุ์แบบจับกลุ่ม (ปลูกได้หลายชนิด ชนิดละหลายพันธุ์)

  // --- consumer passport extras (optional) ---
  description?: string; // คำโปรยหน้า passport
  careTips?: string; // การดูแลเบื้องต้น
  photoUrl?: string; // รูปฟาร์ม (data URI or path)

  plan?: "free" | "pro"; // แพ็กเกจ — carbon dashboard เป็นฟีเจอร์ Pro
  status: SupplierStatus; // ใช้งาน / ระงับ (managed by KYN)
  createdAt: string; // ISO

  // --- produce extension (ดอกไม้ → ผลไม้/ผัก) ---
  productCategories?: ProductCategory[]; // ประเภทสินค้าที่ปลูก (derived from flowerTypes[].category)
  certifications?: Certification[]; // ใบรับรองมาตรฐานสินค้าเกษตร

  // --- resource types (KYN sheet 21 Sep 2026): the "primary" type of each input, amounts stay in
  // fuelLitres / fertilizerKg / agriChemicalsKg; per-product monthly yield replaces flowersPerMonth ---
  fuelKind?: FuelKind;
  fertilizerKind?: FertilizerKind;
  chemicalKind?: ChemicalKind;
  yieldLines?: YieldLine[]; // ผลผลิตต่อเดือน แยกตามรายการสินค้าที่ลงไว้
  signupVia?: CarrierKey; // สมัครผ่านลิงก์ของผู้ขนส่งรายนี้ → รูปแบบจัดส่งถูกจำกัดตามลิงก์
}

// รูปแบบการจัดส่ง (KYN spec §1.2) — also the "?via=" value of carrier-specific signup links
export type CarrierKey = "thaipost" | "cold_chain" | "private" | "sorting_center" | "exporter";

export interface InnerMaterialLine { material: string; qty: number }

export type FuelKind = "diesel" | "gasoline" | "lpg";
export type FertilizerKind = "urea" | "npk" | "organic";
export type ChemicalKind = "insecticide" | "herbicide" | "fungicide" | "none";

// ผลผลิตทั้งหมดต่อเดือนของ 1 รายการ (ชนิด — พันธุ์): ดอกไม้นับดอก, ผัก/ผลไม้นับกก.
export interface YieldLine {
  category: ProductCategory;
  type: string;
  variety?: string;
  amount: number; // per month, in `unit`
  unit: "stem" | "kg";
}

// ประเภทสินค้า 3 ชั้น: ประเภท → ชนิด → พันธุ์
export type ProductCategory = "flower" | "fruit" | "vegetable";
// หน่วยนับ: ดอกไม้ = ดอก/ช่อ, ผัก-ผลไม้ = กก./ตัน (ตันเก็บเป็น kg ×1000)
export type QuantityUnit = "stem" | "bunch" | "kg" | "ton";
// ระยะการสุก ณ วันเก็บเกี่ยว
export type Ripeness = "unripe" | "turning" | "ripe" | "overripe";

export interface Certification {
  kind: "GAP" | "GlobalGAP" | "Organic Thailand" | "other";
  name?: string; // ชื่อใบรับรอง (เมื่อ kind = other)
  appliesTo: ProductCategory[]; // ใช้กับประเภทสินค้า
  certNo?: string; // เลขที่ใบรับรอง
  expiresAt?: string; // YYYY-MM-DD
}

// บรรจุภัณฑ์ 1 รายการพร้อมมิติ (หน่วย ซม.) สำหรับสูตรพื้นที่ผิวของ KYN
export interface PackagingLine {
  kind: "basket" | "corrugated_box" | "plastic_film";
  width?: number;
  length?: number;
  height?: number;
  quantity: number;
  basketNo?: string;
  boxMaterial?: string;
}

// ผลการคำนวณแยกส่วน เก็บไว้กับ batch เพื่อแสดงที่มาของตัวเลข
export interface CarbonBreakdownRecord {
  engine: "kyn" | "legacy";
  farm: number;
  packaging: number;
  transport: number;
  total: number;
  perStem: number;
  flowerEF: number;
  netFlowerWeightKg: number;
  packagingWeightKg: number;
  air?: number; // air-freight leg (included in transport)
  innerPackaging?: number; // secondary materials (included in packaging)
}

// สถานะคำนวณ: draft (บันทึกร่าง) → submitted (ส่งแล้ว รอ KYN คำนวณ) → computed (คำนวณแล้ว)
export type BatchStatus = "draft" | "submitted" | "computed";
// สถานะขนส่ง
export type ShipmentStatus = "cutting" | "in_transit" | "delivered";

export interface Batch {
  id: string; // BAT-YYYY-NNNN
  supplierId: string; // → Supplier.id

  // --- ข้อมูลที่ใช้คำนวณ (ลงใหม่ทุกครั้ง / entered every round) ---
  flowerCount: number; // จำนวนดอกไม้ (ในตะกร้า)
  variety?: string; // พันธุ์ดอกไม้ (เช่น Red Naomi) — เลือกจาก dropdown ที่โตจากประวัติของฟาร์ม
  cutDate: string; // วันที่ตัด (YYYY-MM-DD)
  distanceKm: number; // ระยะทาง (ปลายทาง)
  destination?: string; // ปลายทาง เช่น กรุงเทพฯ
  destinationAddress?: string; // ที่อยู่ปลายทาง (ผู้รับ) — carrier-only, never on the public passport
  destLat?: number; // พิกัดปลายทาง
  destLng?: number;
  // --- recorded by the carrier on /logistic/new ---
  shipType?: "domestic" | "international"; // ส่งภายในประเทศ / ส่งต่างประเทศ
  shipDate?: string; // วันที่จัดส่งจริง (YYYY-MM-DD)
  airline?: string; // ส่งต่างประเทศ: สายการบิน
  flightNo?: string; // ส่งต่างประเทศ: หมายเลขเที่ยวบิน
  exportRecordedAt?: string; // ISO — เมื่อผู้ขนส่งบันทึกข้อมูลการจัดส่ง
  exportRecordedBy?: string; // User.id ของผู้บันทึก
  innerMaterials?: InnerMaterialLine[]; // วัสดุภายในกล่อง/ห่อหุ้ม/ผูกยึด (KYN packaging master)
  originAirport?: string; // ส่งต่างประเทศ: สนามบินต้นทาง (IATA)
  destAirport?: string; // ส่งต่างประเทศ: สนามบินปลายทาง (IATA)
  flightDistanceKm?: number; // ระยะบิน (great-circle, km) — ใช้คิดคาร์บอนเที่ยวบิน
  carrier?: string; // รูปแบบการขนส่ง เช่น ไปรษณีย์ไทย / ขนส่งควบคุมอุณหภูมิ / ผู้ส่งออก
  provider?: string; // ผู้ให้บริการขนส่ง (เมื่อไม่ใช่ไปรษณีย์ไทย) เช่น Nim Express
  postalCode?: string; // รหัสไปรษณีย์ปลายทาง
  branch?: string; // สาขาที่นำส่ง
  boxMaterial?: string; // วัสดุภายในกล่อง (บรรจุภัณฑ์)
  weightKg?: number; // น้ำหนักรวม (kg) — passport
  forwardedCount?: number; // ส่งต่อ (ดอก) — logistics throughput; received = flowerCount
  discardedCount?: number; // คัดทิ้ง (ดอก) — logistics reject; คงเหลือ = flowerCount − forwarded − discarded
  basketIds: string[]; // ตะกร้าที่ใช้รอบนี้ (หลายใบได้) — ระบบนับจำนวนการใช้ซ้ำเองเพื่อคิดคาร์บอน

  // --- produce extension (ผลไม้/ผัก) — legacy rows: productCategory "flower", unit "stem", quantity = flowerCount ---
  productCategory?: ProductCategory; // ประเภทสินค้า
  productType?: string; // ชนิด (เช่น มะม่วง, กุหลาบ)
  quantity?: number; // จำนวนในหน่วย `unit` (ดอกไม้: = flowerCount; ผัก/ผลไม้: กก.)
  unit?: QuantityUnit; // หน่วยนับ
  plantingDate?: string; // วันที่ปลูก (YYYY-MM-DD) — ผัก/ผลไม้
  ripenessAtHarvest?: Ripeness; // ระยะการสุก ณ วันเก็บเกี่ยว — ผลไม้
  grade?: string; // เกรด A / B / C / export
  ethyleneUsed?: boolean; // ใช้ก๊าซเอทิลีน/สารยับยั้งการสุก
  ethyleneNote?: string; // ปริมาณ/รายละเอียด

  // --- KYN full-spec inputs (ถ้ามีครบ ระบบจะใช้เครื่องคำนวณชุดใหม่) ---
  packagingItems?: PackagingLine[]; // บรรจุภัณฑ์พร้อมมิติ W×L×H
  shippedWeightKg?: number; // น้ำหนักพัสดุรวมที่ชั่งจริงก่อนส่ง (kg)
  vehicleKey?: string; // ประเภทรถ (→ transport-ef VEHICLE_PROFILE)
  fuelKey?: string; // เชื้อเพลิง (→ transport-ef FUEL_EF)
  isReeferUsed?: boolean; // ใช้ตู้แช่เย็น → คูณ 1.15
  carbonBreakdown?: CarbonBreakdownRecord; // ผลแยกส่วนที่คำนวณไว้ (เพื่อความโปร่งใส)

  entryDate: string; // วันที่ลงข้อมูล (auto, YYYY-MM-DD)

  // --- computed by the KYN engine (0 until status === "computed") ---
  co2ePerFlower: number; // kg CO2e / flower
  ageDays: number; // ระยะเวลาดอกไม้หลังตัด (days)

  status: BatchStatus; // สถานะคำนวณ
  shipmentStatus: ShipmentStatus; // สถานะขนส่ง
  createdAt: string; // ISO
}

// บันทึกการใช้ทรัพยากรรายเดือนของฟาร์ม (KYN: farm_monthly_inputs).
// ใช้คำนวณ Dynamic_Flower_EF = คาร์บอนรวมของเดือนนั้น ÷ ผลผลิตดอกไม้ (kg) ของเดือนนั้น
export interface FarmMonthlyInput {
  id: string; // FMI-NNNN
  supplierId: string; // → Supplier.id
  reportingMonth: string; // YYYY-MM
  dieselLitres?: number; // ลิตร/เดือน
  electricityKwh?: number; // kWh/เดือน
  fertilizerKg?: number; // ปุ๋ยเคมี kg/เดือน
  agrochemicalKg?: number; // สารเคมีเกษตร kg/เดือน
  waterM3?: number; // น้ำ ลบ.ม./เดือน
  organicWasteKg?: number; // ของเสียอินทรีย์ kg/เดือน
  totalFlowerYieldKg?: number; // น้ำหนักดอกไม้ที่ตัดขายได้ทั้งเดือน (kg) — ตัวหารของ Dynamic EF
  createdAt: string;
  // in-memory only: per-type EFs from the farm's resource kinds (never stored)
  fuelEf?: number;
  fertilizerEf?: number;
  agrochemicalEf?: number;
}

// Portal roles. Each account belongs to exactly one.
export type UserRole = "supplier" | "logistic" | "kyn";

// User account (any role). Password is scrypt-hashed (see lib/auth).
export interface User {
  id: string; // USR-NNNN
  role: UserRole; // which portal this account signs into
  supplierId?: string; // → Supplier.id (only for role "supplier")
  company?: string; // ชื่อบริษัท (logistic accounts)
  branch?: string; // สาขา (logistic accounts)
  phone?: string; // เบอร์โทร (โปรไฟล์ผู้ใช้)
  email: string;
  username: string;
  passwordHash: string; // hex
  salt: string; // hex
  createdAt: string; // ISO
  status?: "active" | "suspended"; // KYN can suspend a login; undefined = active
}

// Team management (จัดการระบบ) — members + invites, scoped to an org (supplierId).
export type MemberRole = "org_admin" | "member";

export interface Member {
  id: string; // MEM-NNNN
  supplierId: string; // org
  name: string;
  email: string;
  role: MemberRole;
  lastActiveAt?: string; // ISO
  createdAt: string;
}

export interface Invite {
  id: string; // INV-NNNN
  supplierId: string;
  email: string;
  role: MemberRole;
  invitedAt: string;
  status: "pending" | "cancelled" | "accepted";
  token?: string; // secret for the /join/<token> link in the invite email
}

// Notification (bell / Noti screen).
export interface Notification {
  id: string;
  supplierId?: string;
  title: string;
  body: string;
  kind: "info" | "success" | "warning";
  createdAt: string;
  read?: boolean;
}

// A record that a QR label was printed (Thai Post → KYN Shipment/QR log).
export interface PrintLog {
  id: string; // PRT-NNNN
  supplierId: string;
  batchId?: string;
  destination?: string; // ปลายทาง
  printedBy: string; // เช่น "Thaipost"
  sortingPoint?: string; // จุดคัดแยก
  printedAt: string; // ISO
  cancelled?: boolean; // ยกเลิก (พิมพ์ผิด) — batch นั้นกลับมา "ยังไม่ได้พิมพ์" อีกครั้ง
}

// Payloads accepted by the API (server fills id / computed / timestamps / status).
export type SupplierInput = Omit<Supplier, "id" | "createdAt" | "status">;
export type BatchInput = Pick<
  Batch,
  "supplierId" | "flowerCount" | "cutDate" | "distanceKm"
> & {
  variety?: string;
  destination?: string;
  destinationAddress?: string;
  destLat?: number;
  destLng?: number;
  innerMaterials?: InnerMaterialLine[];
  carrier?: string;
  provider?: string;
  postalCode?: string;
  branch?: string;
  boxMaterial?: string;
  weightKg?: number;
  basketIds?: string[];
  packagingItems?: PackagingLine[];
  shippedWeightKg?: number;
  vehicleKey?: string;
  fuelKey?: string;
  isReeferUsed?: boolean;
  status?: BatchStatus; // "draft" | "submitted"
  // produce extension
  productCategory?: ProductCategory;
  productType?: string;
  quantity?: number;
  unit?: QuantityUnit;
  plantingDate?: string;
  ripenessAtHarvest?: Ripeness;
  grade?: string;
  ethyleneUsed?: boolean;
  ethyleneNote?: string;
};

// A batch joined to its supplier — what the KYN table and trace page consume.
export interface BatchWithSupplier extends Batch {
  supplier: Supplier | null;
}
