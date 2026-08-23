// KLORA domain types.
// SUP = Supplier (ผู้ผลิต/ฟาร์ม). Batch = a shipment of cut flowers logged each cutting round.

export type SupplierStatus = "active" | "suspended"; // ใช้งาน / ระงับ

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
  varieties?: string[]; // พันธุ์ดอกไม้ที่ปลูก

  // --- consumer passport extras (optional) ---
  description?: string; // คำโปรยหน้า passport
  careTips?: string; // การดูแลเบื้องต้น
  photoUrl?: string; // รูปฟาร์ม (data URI or path)

  plan?: "free" | "pro"; // แพ็กเกจ — carbon dashboard เป็นฟีเจอร์ Pro
  status: SupplierStatus; // ใช้งาน / ระงับ (managed by KYN)
  createdAt: string; // ISO
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
  carrier?: string; // รูปแบบการขนส่ง เช่น ไปรษณีย์ / Cold Chain / Exporter
  postalCode?: string; // รหัสไปรษณีย์ปลายทาง
  branch?: string; // สาขาที่นำส่ง
  boxMaterial?: string; // วัสดุภายในกล่อง (บรรจุภัณฑ์)
  weightKg?: number; // น้ำหนักรวม (kg) — passport
  basketIds: string[]; // ตะกร้าที่ใช้รอบนี้ (หลายใบได้) — ระบบนับจำนวนการใช้ซ้ำเองเพื่อคิดคาร์บอน

  entryDate: string; // วันที่ลงข้อมูล (auto, YYYY-MM-DD)

  // --- computed by the KYN engine (0 until status === "computed") ---
  co2ePerFlower: number; // kg CO2e / flower
  ageDays: number; // ระยะเวลาดอกไม้หลังตัด (days)

  status: BatchStatus; // สถานะคำนวณ
  shipmentStatus: ShipmentStatus; // สถานะขนส่ง
  createdAt: string; // ISO
}

// Portal roles. Each account belongs to exactly one.
export type UserRole = "supplier" | "logistic" | "kyn";

// User account (any role). Password is scrypt-hashed (see lib/auth).
export interface User {
  id: string; // USR-NNNN
  role: UserRole; // which portal this account signs into
  supplierId?: string; // → Supplier.id (only for role "supplier")
  email: string;
  username: string;
  passwordHash: string; // hex
  salt: string; // hex
  createdAt: string; // ISO
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
  carrier?: string;
  postalCode?: string;
  branch?: string;
  boxMaterial?: string;
  weightKg?: number;
  basketIds?: string[];
  status?: BatchStatus; // "draft" | "submitted"
};

// A batch joined to its supplier — what the KYN table and trace page consume.
export interface BatchWithSupplier extends Batch {
  supplier: Supplier | null;
}
