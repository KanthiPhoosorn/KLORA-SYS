// KLORA-SYS domain types.
// SUP = Supplier (ผู้ผลิต/ฟาร์ม). Batch = a shipment of cut flowers logged each cutting round.

export interface Supplier {
  id: string; // SUP-YYYY-NNNN — issued by the system

  // --- ข้อมูลพื้นฐานบังคับ (mandatory profile) ---
  farmName: string; // ชื่อฟาร์ม
  address: string; // ที่อยู่
  gpsLat: number; // พิกัด GPS
  gpsLng: number;
  owner: string; // เจ้าของฟาร์ม
  flowerType: string; // ประเภทดอกไม้
  highlights: string; // จุดเด่นฟาร์ม
  contact: string; // ช่องทางติดต่อ

  // --- ข้อมูลพื้นฐานไม่บังคับ / ใช้คำนวณ (optional, set once) ---
  fuelLitres?: number; // Fuel — litres of diesel per cutting round
  electricityKwh?: number; // Electricity — kWh per cutting round
  fertilizerKg?: number; // Fertilizer — kg per cutting round
  basketId?: string; // Basket ID
  reuseCycles?: number; // Reuse Cycle — how many trips one basket survives

  createdAt: string; // ISO
}

export interface Batch {
  id: string; // BAT-YYYY-NNNN
  supplierId: string; // → Supplier.id

  // --- ข้อมูลที่ใช้คำนวณ (ลงใหม่ทุกครั้ง / entered every round) ---
  flowerCount: number; // จำนวนดอกไม้ (ในตะกร้า)
  cutDate: string; // วันที่ตัด (YYYY-MM-DD)
  distanceKm: number; // ระยะทาง (ปลายทาง)

  entryDate: string; // วันที่ลงข้อมูล (auto, YYYY-MM-DD)

  // --- computed by the KYN engine ---
  co2ePerFlower: number; // kg CO2e / flower
  ageDays: number; // ระยะเวลาดอกไม้หลังตัด (days)

  createdAt: string; // ISO
}

// Payloads accepted by the API (server fills id / computed / timestamps).
export type SupplierInput = Omit<Supplier, "id" | "createdAt">;
export type BatchInput = Pick<
  Batch,
  "supplierId" | "flowerCount" | "cutDate" | "distanceKm"
>;

// A batch joined to its supplier — what the KYN table and trace page consume.
export interface BatchWithSupplier extends Batch {
  supplier: Supplier | null;
}
