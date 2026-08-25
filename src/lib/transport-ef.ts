// Transport emission factors.
//
// SOURCE OF THE FUEL NUMBERS (official):
//   TGO — "ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับการประมาณค่าคาร์บอนฟุตพริ้นท์ขององค์กร"
//   UPDATE: กุมภาพันธ์ 2569 · บังคับใช้ตั้งแต่ 1 มกราคม พ.ศ. 2569
//   https://thaicarbonlabel.tgo.or.th → Emission Factor (CFO)
//   Section "Mobile Source → On-road vehicles". Values below are the TOTAL kgCO2e column
//   (CO2 fossil + CH4 + N2O), not the CO2-only column.
//
// ⚠ IMPORTANT: TGO's CFO factor list contains **no tonne-km or vehicle-km freight factors**
// (verified: zero matching rows in the Feb-2026 document). KYN's spec asks for EF_tkm / EF_vkm,
// so those cannot be quoted from TGO directly — they are DERIVED here as:
//
//     EF_vkm = fuel consumed per km  ×  EF_fuel          (kg CO2e / vehicle-km)
//     EF_tkm = EF_vkm ÷ typical payload in tonnes         (kg CO2e / tonne-km)
//
// The fuel EFs are official. The CONSUMPTION and PAYLOAD figures are operational assumptions
// (flagged `assumption: true`) — KYN should replace them with real fleet averages.

export interface FuelFactor {
  key: string;
  label: string;
  /** kg CO2e per unit */
  ef: number;
  unit: "liter" | "kg" | "kWh";
  /** true when the value is quoted directly from the TGO Feb-2026 CFO table */
  official: boolean;
  note?: string;
}

/** TGO on-road (Mobile Source → On-road vehicles) totals, kgCO2e per unit. */
export const FUEL_EF: Record<string, FuelFactor> = {
  B7: { key: "B7", label: "ดีเซล B7", ef: 2.5504, unit: "liter", official: true, note: "Scope 1 (fossil); biogenic 0.1151 kgCO2/L รายงานแยก" },
  B20: { key: "B20", label: "ดีเซล B20", ef: 2.1976, unit: "liter", official: true, note: "Scope 1 (fossil); biogenic 0.3288 kgCO2/L รายงานแยก" },
  diesel: { key: "diesel", label: "ดีเซล (ไม่ผสม)", ef: 2.7403, unit: "liter", official: true },
  B10: { key: "B10", label: "ดีเซล B10", ef: 2.4034, unit: "liter", official: false, note: "⚠ TGO ไม่มีค่า B10 — ประมาณเชิงเส้นระหว่าง B7 (2.5504) และ B20 (2.1976)" },
  gasoline: { key: "gasoline", label: "เบนซิน", ef: 2.2703, unit: "liter", official: true, note: "Motor Gasoline – oxidation catalyst" },
  E10: { key: "E10", label: "แก๊สโซฮอล์ E10", ef: 2.0444, unit: "liter", official: true, note: "Scope 1 (fossil), oxidation catalyst" },
  E20: { key: "E20", label: "แก๊สโซฮอล์ E20", ef: 1.8184, unit: "liter", official: true, note: "Scope 1 (fossil)" },
  E85: { key: "E85", label: "แก๊สโซฮอล์ E85", ef: 0.3496, unit: "liter", official: true, note: "Scope 1 (fossil)" },
  LPG: { key: "LPG", label: "LPG", ef: 1.7273, unit: "liter", official: true },
  CNG: { key: "CNG", label: "CNG / NGV", ef: 2.254, unit: "kg", official: true },
  EV: { key: "EV", label: "ไฟฟ้า (EV)", ef: 0.475, unit: "kWh", official: true, note: "ไฟฟ้า grid mix ปี 2022-2024 (CFO Scope 2)" },
  bi_fuel: { key: "bi_fuel", label: "สองเชื้อเพลิง", ef: 2.0444, unit: "liter", official: false, note: "⚠ สมมติใช้ค่า E10 เป็นตัวแทน — ควรเลือกเชื้อเพลิงจริงที่ใช้" },
};

export interface VehicleProfile {
  key: string;
  label: string;
  /** litres (or kg / kWh for CNG / EV) consumed per 100 km — OPERATIONAL ASSUMPTION */
  consumptionPer100Km: number;
  /** typical usable payload in tonnes — OPERATIONAL ASSUMPTION */
  payloadTonnes: number;
  assumption: true;
}

/**
 * ⚠ ALL numbers in this table are assumptions, not TGO figures.
 * They exist so the t.km / v.km formulas can run; replace with KYN fleet data.
 */
export const VEHICLE_PROFILE: Record<string, VehicleProfile> = {
  sedan: { key: "sedan", label: "รถยนต์ขนาดเล็ก", consumptionPer100Km: 7, payloadTonnes: 0.3, assumption: true },
  suv: { key: "suv", label: "รถอเนกประสงค์", consumptionPer100Km: 9, payloadTonnes: 0.4, assumption: true },
  ev_passenger: { key: "ev_passenger", label: "รถยนต์ไฟฟ้า", consumptionPer100Km: 16, payloadTonnes: 0.3, assumption: true },
  phev_hev: { key: "phev_hev", label: "ไฮบริด / ปลั๊กอินไฮบริด", consumptionPer100Km: 4.5, payloadTonnes: 0.3, assumption: true },
  pickup: { key: "pickup", label: "รถกระบะ 4 ล้อ", consumptionPer100Km: 10, payloadTonnes: 1, assumption: true },
  van: { key: "van", label: "รถตู้ขนส่งพัสดุ", consumptionPer100Km: 11, payloadTonnes: 1.2, assumption: true },
  lmv: { key: "lmv", label: "รถอเนกประสงค์ขนาดเล็ก", consumptionPer100Km: 8, payloadTonnes: 0.5, assumption: true },
  "6_wheeler": { key: "6_wheeler", label: "รถบรรทุก 6 ล้อ", consumptionPer100Km: 20, payloadTonnes: 6, assumption: true },
  "10_wheeler": { key: "10_wheeler", label: "รถบรรทุก 10 ล้อ", consumptionPer100Km: 28, payloadTonnes: 15, assumption: true },
  full_trailer: { key: "full_trailer", label: "รถลากพ่วง", consumptionPer100Km: 35, payloadTonnes: 25, assumption: true },
  semi_trailer: { key: "semi_trailer", label: "รถกึ่งพ่วง", consumptionPer100Km: 33, payloadTonnes: 24, assumption: true },
  bus: { key: "bus", label: "รถโดยสาร", consumptionPer100Km: 25, payloadTonnes: 3, assumption: true },
  motorcycle: { key: "motorcycle", label: "จักรยานยนต์ขนส่ง", consumptionPer100Km: 2.2, payloadTonnes: 0.05, assumption: true },
  motorcycle_ev: { key: "motorcycle_ev", label: "จักรยานยนต์ไฟฟ้า", consumptionPer100Km: 3.5, payloadTonnes: 0.05, assumption: true },
  bi_fuel: { key: "bi_fuel", label: "น้ำมันสลับก๊าซ", consumptionPer100Km: 9, payloadTonnes: 0.4, assumption: true },
};

export interface DerivedTransportEF {
  efVkm: number; // kg CO2e / vehicle-km
  efTkm: number; // kg CO2e / tonne-km
  /** false whenever any input was an assumption rather than a published TGO figure */
  official: false;
  basis: string;
}

/** EF per vehicle-km and per tonne-km for a vehicle × fuel pair. */
export function deriveTransportEF(vehicleKey: string, fuelKey: string): DerivedTransportEF | null {
  const v = VEHICLE_PROFILE[vehicleKey];
  const f = FUEL_EF[fuelKey];
  if (!v || !f) return null;
  const efVkm = (v.consumptionPer100Km / 100) * f.ef;
  const efTkm = v.payloadTonnes > 0 ? efVkm / v.payloadTonnes : 0;
  return {
    efVkm,
    efTkm,
    official: false,
    basis: `${v.consumptionPer100Km}/100km × ${f.ef} kgCO2e/${f.unit} (TGO ก.พ. 2569) ÷ ${v.payloadTonnes} ตัน`,
  };
}
