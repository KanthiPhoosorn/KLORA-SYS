import type { Tone } from "@/components/ui";
import type { BatchStatus, ShipmentStatus, SupplierStatus } from "./types";

// สถานะคำนวณ (calc)
export const CALC_STATUS: Record<BatchStatus, { label: string; tone: Tone }> = {
  draft: { label: "ร่าง", tone: "neutral" },
  submitted: { label: "รอคำนวณ", tone: "amber" },
  computed: { label: "คำนวณแล้ว", tone: "green" },
};

// สถานะขนส่ง (shipment)
export const SHIP_STATUS: Record<ShipmentStatus, { label: string; tone: Tone }> = {
  cutting: { label: "ตัดดอก", tone: "neutral" },
  in_transit: { label: "กำลังขนส่ง", tone: "blue" },
  delivered: { label: "ถึงแล้ว", tone: "green" },
};

// สถานะฟาร์ม
export const SUP_STATUS: Record<SupplierStatus, { label: string; tone: Tone }> = {
  active: { label: "ใช้งาน", tone: "green" },
  suspended: { label: "ระงับ", tone: "neutral" },
};

export function freshnessTone(ageDays: number): Tone {
  return ageDays <= 2 ? "green" : ageDays <= 5 ? "amber" : "red";
}
