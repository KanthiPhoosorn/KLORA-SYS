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
  basketIds: string[]; // ตะกร้าที่ใช้รอบนี้ (หลายใบได้) — ระบบนับจำนวนการใช้ซ้ำเองเพื่อคิดคาร์บอน

  entryDate: string; // วันที่ลงข้อมูล (auto, YYYY-MM-DD)

  // --- computed by the KYN engine (0 until status === "computed") ---
  co2ePerFlower: number; // kg CO2e / flower
  ageDays: number; // ระยะเวลาดอกไม้หลังตัด (days)

  status: BatchStatus; // สถานะคำนวณ
  shipmentStatus: ShipmentStatus; // สถานะขนส่ง
  createdAt: string; // ISO
}

// User account for the SUP (farm) role. Password is scrypt-hashed (see lib/auth).
export interface User {
  id: string; // USR-NNNN
  supplierId: string; // → Supplier.id
  email: string;
  username: string;
  passwordHash: string; // hex
  salt: string; // hex
  createdAt: string; // ISO
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
  basketIds?: string[];
  status?: BatchStatus; // "draft" | "submitted"
};

// A batch joined to its supplier — what the KYN table and trace page consume.
export interface BatchWithSupplier extends Batch {
  supplier: Supplier | null;
}
