// Farm resource types + emission factors — KYN sheet "ข้อมูลทรัพยากร"
// (Google Sheet 1DtRw6h55PgWp3leMQwg5OOs5iJURoBdOwDDM-X7C5sw, values as of 9 Oct 2026).
// A range uses its midpoint as the factor; `efRange` keeps the sheet's text for the disclosure UI.
// A farm can declare several types per input ("เพิ่มรายการ"); the engine then uses the
// amount-weighted factor, so  total amount × weighted EF  =  Σ amount × EF  of every line.
import type { ChemicalKind, FertilizerKind, FuelKind } from "./types";

export interface ResourceType<K extends string> { key: K; label: string; unit: string; ef: number; efRange?: string; source?: string }

export const FUEL_TYPES: ResourceType<FuelKind>[] = [
  { key: "diesel", label: "ดีเซล", unit: "ลิตร", ef: 2.68 },
  { key: "gasoline", label: "เบนซิน / แก๊สโซฮอล์", unit: "ลิตร", ef: 2.31 },
  { key: "lpg", label: "LPG", unit: "กก.", ef: 2.255, efRange: "1.51–3.00" },
];

export const FERTILIZER_TYPES: ResourceType<FertilizerKind>[] = [
  { key: "urea", label: "ปุ๋ยไนโตรเจนสังเคราะห์ (ยูเรีย)", unit: "กก.", ef: 2.2474, source: "Yuttitham et al. (งานวิจัยไทย)" },
  { key: "npk", label: "ปุ๋ยสูตรผสม NPK", unit: "กก.", ef: 1.5, source: "Carbon Footprint / รายงานคำนวณ NPK" },
  { key: "organic", label: "ปุ๋ยอินทรีย์ / ปุ๋ยคอก / ปุ๋ยหมัก", unit: "กก.", ef: 0.3323, source: "อบก." },
];

export const CHEMICAL_TYPES: ResourceType<ChemicalKind>[] = [
  { key: "insecticide", label: "สารกำจัดแมลง (Insecticide)", unit: "กก.", ef: 5.1, source: "Lal (2004)" },
  { key: "herbicide", label: "สารกำจัดวัชพืช (Herbicide)", unit: "กก.", ef: 6.3, source: "Lal (2004)" },
  { key: "fungicide", label: "สารป้องกันเชื้อรา (Fungicide)", unit: "กก.", ef: 3.9, source: "Lal (2004)" },
  { key: "none", label: "ไม่ใช้สารเคมี", unit: "กก.", ef: 0 },
];

export const fuelEf = (k?: FuelKind | null) => FUEL_TYPES.find((t) => t.key === k)?.ef;
export const fertilizerEf = (k?: FertilizerKind | null) => FERTILIZER_TYPES.find((t) => t.key === k)?.ef;
export const chemicalEf = (k?: ChemicalKind | null) => CHEMICAL_TYPES.find((t) => t.key === k)?.ef;

// ---- several lines per input -------------------------------------------------------------
/** "other" = อื่นๆ (ระบุ): the typed name is kept in `other`, priced with KYN's generic factor. */
export interface ResourceLine { kind: string; amount: number; other?: string }
export interface ResourceLines { fuel: ResourceLine[]; fertilizer: ResourceLine[]; chemical: ResourceLine[] }
export type ResourceGroup = keyof ResourceLines;
export const OTHER_KIND = "other";

export const RESOURCE_TABLES: Record<ResourceGroup, ResourceType<string>[]> = {
  fuel: FUEL_TYPES, fertilizer: FERTILIZER_TYPES, chemical: CHEMICAL_TYPES,
};

/** Σ amount of a group (the totals the engine multiplies). */
export const linesTotal = (lines: ResourceLine[] = []) => lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);

/** Amount-weighted EF of a group; an "อื่นๆ" line uses the factor KYN confirmed for that name
 *  (`approved`, keyed by lower-case name), else `generic` (KYN's editable fallback). */
export function weightedEf(group: ResourceGroup, lines: ResourceLine[] = [], generic: number, approved?: Map<string, number>): number | undefined {
  const total = linesTotal(lines);
  if (!(total > 0)) return undefined;
  const table = RESOURCE_TABLES[group];
  const kg = lines.reduce((s, l) => {
    if (!(l.amount > 0)) return s;
    const ef = l.kind === OTHER_KIND ? approved?.get((l.other ?? "").toLowerCase()) ?? generic : table.find((t) => t.key === l.kind)?.ef ?? generic;
    return s + l.amount * ef;
  }, 0);
  return kg / total;
}

const clean = (group: ResourceGroup, v: unknown): ResourceLine[] => {
  if (!Array.isArray(v)) return [];
  const keys = new Set(RESOURCE_TABLES[group].map((t) => t.key));
  return (v as Record<string, unknown>[])
    .map((l) => ({
      kind: String(l?.kind ?? ""),
      amount: Number(l?.amount) > 0 ? Number(l.amount) : 0,
      other: l?.kind === OTHER_KIND ? String(l?.other ?? "").trim().slice(0, 80) : undefined,
    }))
    .filter((l) => (keys.has(l.kind) || (l.kind === OTHER_KIND && l.other)))
    .slice(0, 12);
};

/** Parse + sanitise the `resourceLines` request field (null when absent/empty). */
export function parseResourceLines(v: unknown): ResourceLines | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: ResourceLines = { fuel: clean("fuel", o.fuel), fertilizer: clean("fertilizer", o.fertilizer), chemical: clean("chemical", o.chemical) };
  return out.fuel.length || out.fertilizer.length || out.chemical.length ? out : null;
}

/** Lines → the legacy single-type fields (primary kind = the largest line) + totals. */
export function linesToLegacy(l: ResourceLines) {
  const primary = <K extends string>(lines: ResourceLine[], fallback: K) =>
    ([...lines].filter((x) => x.kind !== OTHER_KIND).sort((a, b) => b.amount - a.amount)[0]?.kind as K | undefined) ?? fallback;
  return {
    fuelKind: primary<FuelKind>(l.fuel, "diesel"),
    fertilizerKind: primary<FertilizerKind>(l.fertilizer, "npk"),
    chemicalKind: linesTotal(l.chemical) > 0 ? primary<ChemicalKind>(l.chemical, "insecticide") : ("none" as ChemicalKind),
    fuelLitres: linesTotal(l.fuel),
    fertilizerKg: linesTotal(l.fertilizer),
    agriChemicalsKg: linesTotal(l.chemical),
  };
}

/** Lines of a farm: stored lines, else one line per legacy single-type field. */
export function farmResourceLines(s: {
  resourceLines?: ResourceLines | null; fuelKind?: string; fertilizerKind?: string; chemicalKind?: string;
  fuelLitres?: number; fertilizerKg?: number; agriChemicalsKg?: number;
}): ResourceLines {
  if (s.resourceLines) return s.resourceLines;
  return {
    fuel: s.fuelLitres ? [{ kind: s.fuelKind ?? "diesel", amount: s.fuelLitres }] : [],
    fertilizer: s.fertilizerKg ? [{ kind: s.fertilizerKind ?? "npk", amount: s.fertilizerKg }] : [],
    chemical: s.agriChemicalsKg ? [{ kind: s.chemicalKind && s.chemicalKind !== "none" ? s.chemicalKind : "insecticide", amount: s.agriChemicalsKg }] : [],
  };
}
