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
// The fuel EFs are official TGO figures. The CONSUMPTION + PAYLOAD figures now come from KYN's
// `vehicle_efficiency_payload_list` sheet (25 Aug 2026) for 9 vehicle classes — those rows are
// marked `source: "kyn"`. A few classes KYN did not cover are still `source: "assumption"`.

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
  /** KYN fleet data — km per litre (or km per kWh for EVs), min/max range */
  kmPerUnitMin?: number;
  kmPerUnitMax?: number;
  /** litres (kWh for EV) consumed per 100 km — derived from the km/L midpoint */
  consumptionPer100Km: number;
  /** Avg_Payload_Tons from KYN */
  payloadTonnes: number;
  /** Max_Payload_Tons from KYN */
  maxPayloadTonnes?: number;
  /** "kyn" = supplied by KYN fleet data · "assumption" = still our estimate */
  source: "kyn" | "assumption";
}

/**
 * Fuel-efficiency + payload per vehicle class.
 * `source: "kyn"` rows come from KYN's `vehicle_efficiency_payload_list` sheet
 * (Efficiency_km_per_L_Min/Max → midpoint → L/100km; Avg_Payload_Tons).
 * `source: "assumption"` rows are classes KYN has not supplied yet.
 */
export const VEHICLE_PROFILE: Record<string, VehicleProfile> = {
  motorcycle: { key: "motorcycle", label: "จักรยานยนต์ขนส่ง", kmPerUnitMin: 35, kmPerUnitMax: 45, consumptionPer100Km: 2.5, payloadTonnes: 0.04, maxPayloadTonnes: 0.1, source: "kyn" },
  sedan: { key: "sedan", label: "รถยนต์ขนาดเล็ก", kmPerUnitMin: 14, kmPerUnitMax: 17, consumptionPer100Km: 6.4516, payloadTonnes: 0.12, maxPayloadTonnes: 0.4, source: "kyn" },
  suv: { key: "suv", label: "รถอเนกประสงค์", kmPerUnitMin: 11, kmPerUnitMax: 13, consumptionPer100Km: 8.3333, payloadTonnes: 0.2, maxPayloadTonnes: 0.5, source: "kyn" },
  pickup: { key: "pickup", label: "รถกระบะ 4 ล้อ", kmPerUnitMin: 10.5, kmPerUnitMax: 12.5, consumptionPer100Km: 8.6957, payloadTonnes: 1, maxPayloadTonnes: 1.5, source: "kyn" },
  // KYN calls this class `cargo_van`; the vehicle/fuel mapping list uses `van` — both resolve here.
  van: { key: "van", label: "รถตู้ขนส่งพัสดุ", kmPerUnitMin: 10, kmPerUnitMax: 12, consumptionPer100Km: 9.0909, payloadTonnes: 0.8, maxPayloadTonnes: 1.2, source: "kyn" },
  cargo_van: { key: "cargo_van", label: "รถตู้ขนส่งพัสดุ", kmPerUnitMin: 10, kmPerUnitMax: 12, consumptionPer100Km: 9.0909, payloadTonnes: 0.8, maxPayloadTonnes: 1.2, source: "kyn" },
  lmv: { key: "lmv", label: "รถอเนกประสงค์ขนาดเล็ก", kmPerUnitMin: 11, kmPerUnitMax: 13, consumptionPer100Km: 8.3333, payloadTonnes: 0.5, maxPayloadTonnes: 0.8, source: "kyn" },
  "6_wheeler": { key: "6_wheeler", label: "รถบรรทุก 6 ล้อ", kmPerUnitMin: 5.5, kmPerUnitMax: 6.5, consumptionPer100Km: 16.6667, payloadTonnes: 4.75, maxPayloadTonnes: 7, source: "kyn" },
  "10_wheeler": { key: "10_wheeler", label: "รถบรรทุก 10 ล้อ", kmPerUnitMin: 3.8, kmPerUnitMax: 4.5, consumptionPer100Km: 24.0964, payloadTonnes: 13.25, maxPayloadTonnes: 16, source: "kyn" },
  // KYN gives one combined "trailer" class; the mapping list splits full/semi — both use it.
  full_trailer: { key: "full_trailer", label: "รถลากพ่วง", kmPerUnitMin: 2.5, kmPerUnitMax: 3.2, consumptionPer100Km: 35.0877, payloadTonnes: 26.5, maxPayloadTonnes: 32, source: "kyn" },
  semi_trailer: { key: "semi_trailer", label: "รถกึ่งพ่วง", kmPerUnitMin: 2.5, kmPerUnitMax: 3.2, consumptionPer100Km: 35.0877, payloadTonnes: 26.5, maxPayloadTonnes: 32, source: "kyn" },
  trailer: { key: "trailer", label: "รถพ่วง / กึ่งพ่วง", kmPerUnitMin: 2.5, kmPerUnitMax: 3.2, consumptionPer100Km: 35.0877, payloadTonnes: 26.5, maxPayloadTonnes: 32, source: "kyn" },
  // EVs — KYN note: sedan_ev = 6.0 km/kWh, pickup_ev = 4.0 km/kWh (consumption is kWh/100km).
  ev_passenger: { key: "ev_passenger", label: "รถยนต์ไฟฟ้า", kmPerUnitMin: 6, kmPerUnitMax: 6, consumptionPer100Km: 16.6667, payloadTonnes: 0.12, maxPayloadTonnes: 0.4, source: "kyn" },
  pickup_ev: { key: "pickup_ev", label: "รถกระบะไฟฟ้า", kmPerUnitMin: 4, kmPerUnitMax: 4, consumptionPer100Km: 25, payloadTonnes: 1, maxPayloadTonnes: 1.5, source: "kyn" },
  // ⚠ still assumptions — KYN has not supplied these classes
  phev_hev: { key: "phev_hev", label: "ไฮบริด / ปลั๊กอินไฮบริด", consumptionPer100Km: 4.5, payloadTonnes: 0.12, source: "assumption" },
  bus: { key: "bus", label: "รถโดยสาร", consumptionPer100Km: 25, payloadTonnes: 3, source: "assumption" },
  motorcycle_ev: { key: "motorcycle_ev", label: "จักรยานยนต์ไฟฟ้า", consumptionPer100Km: 3.5, payloadTonnes: 0.04, source: "assumption" },
  bi_fuel: { key: "bi_fuel", label: "น้ำมันสลับก๊าซ", consumptionPer100Km: 8.3333, payloadTonnes: 0.2, source: "assumption" },
};

export interface DerivedTransportEF {
  efVkm: number; // kg CO2e / vehicle-km
  efTkm: number; // kg CO2e / tonne-km
  /** true when BOTH the fuel EF (TGO) and the vehicle profile (KYN fleet data) are sourced */
  sourced: boolean;
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
    sourced: f.official && v.source === "kyn",
    basis: `${v.consumptionPer100Km}/100km (${v.source === "kyn" ? "KYN fleet" : "ประมาณการ"}) × ${f.ef} kgCO2e/${f.unit} (${f.official ? "TGO ก.พ. 2569" : "ประมาณการ"}) ÷ ${v.payloadTonnes} ตัน`,
  };
}
