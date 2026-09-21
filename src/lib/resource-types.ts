// Farm resource types + emission factors — from KYN's sheet "ข้อมูลทรัพยากร" (21 Sep 2026,
// Google Sheet 1DtRw6h55PgWp3leMQwg5OOs5iJURoBdOwDDM-X7C5sw). Ranges use the midpoint as the
// default factor; `efRange` keeps the original text for the disclosure UI.
// NOTE: the fertilizer cells "3-6" and "2-4" had been auto-converted to dates in the sheet
// (46176 / 46114 = 3 Jun / 2 Apr) — decoded back to the ranges below; confirm with KYN.
import type { ChemicalKind, FertilizerKind, FuelKind } from "./types";

export interface ResourceType<K extends string> { key: K; label: string; unit: string; ef: number; efRange?: string }

export const FUEL_TYPES: ResourceType<FuelKind>[] = [
  { key: "diesel", label: "ดีเซล", unit: "ลิตร", ef: 2.68 },
  { key: "gasoline", label: "เบนซิน / แก๊สโซฮอล์", unit: "ลิตร", ef: 2.31 },
  { key: "lpg", label: "LPG", unit: "กก.", ef: 2.26, efRange: "1.51–3.00" },
];

export const FERTILIZER_TYPES: ResourceType<FertilizerKind>[] = [
  { key: "urea", label: "ปุ๋ยไนโตรเจนสังเคราะห์ (ยูเรีย)", unit: "กก.", ef: 4.5, efRange: "3–6" },
  { key: "npk", label: "ปุ๋ยสูตรผสม NPK", unit: "กก.", ef: 3.0, efRange: "2–4" },
  { key: "organic", label: "ปุ๋ยอินทรีย์ / ปุ๋ยคอก / ปุ๋ยหมัก", unit: "กก.", ef: 0.3, efRange: "0.1–0.5" },
];

export const CHEMICAL_TYPES: ResourceType<ChemicalKind>[] = [
  { key: "insecticide", label: "สารกำจัดแมลง (Insecticide)", unit: "กก.", ef: 17.5, efRange: "15–20" },
  { key: "herbicide", label: "สารกำจัดวัชพืช (Herbicide)", unit: "กก.", ef: 17.5, efRange: "10–25" },
  { key: "fungicide", label: "สารป้องกันเชื้อรา (Fungicide)", unit: "กก.", ef: 12.5, efRange: "10–15" },
  { key: "none", label: "ไม่ใช้สารเคมี", unit: "กก.", ef: 0 },
];

export const fuelEf = (k?: FuelKind | null) => FUEL_TYPES.find((t) => t.key === k)?.ef;
export const fertilizerEf = (k?: FertilizerKind | null) => FERTILIZER_TYPES.find((t) => t.key === k)?.ef;
export const chemicalEf = (k?: ChemicalKind | null) => CHEMICAL_TYPES.find((t) => t.key === k)?.ef;
