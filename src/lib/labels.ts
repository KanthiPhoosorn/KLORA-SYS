// QR label sizes (Thai Post doc 9 Oct 2026 §13). Landscape stickers, one per page, sized with
// @page in millimetres; or an A4 die-cut sheet of 3 × 9 labels of 60 × 30 mm for office printers.
export type LabelSize = "60x30" | "80x25" | "40x25" | "a4";
export const LABEL_SIZES: { id: LabelSize; name: string; hint: string }[] = [
  { id: "60x30", name: "60 × 30 มม.", hint: "ค่าเริ่มต้น · ห่อช่อดอกไม้ ลังผัก ตะกร้าผลไม้" },
  { id: "80x25", name: "80 × 25 มม.", hint: "ยาวแคบ · ขั้วทุเรียน พันรอบก้านช่อ" },
  { id: "40x25", name: "40 × 25 มม.", hint: "เล็กที่สุดที่ยังสแกนง่าย" },
  { id: "a4", name: "A4 · 3 × 9 ดวง", hint: "กระดาษสติ๊กเกอร์ไดคัท 60 × 30 มม. เครื่องพิมพ์ทั่วไป" },
];
export const asLabelSize = (v: unknown): LabelSize => (LABEL_SIZES.some((s) => s.id === v) ? (v as LabelSize) : "60x30");
