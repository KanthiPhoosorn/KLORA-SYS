// Geography helpers — pure math, safe to import from client components (no fs / node deps).
// Powers the auto-distance estimate on the new-round form and province derivation.

export interface Destination {
  name: string; // ปลายทางที่แสดง
  province: string;
  km: number; // rough road distance from the northern (Chiang Rai/Chiang Mai) growing area
  lat: number;
  lng: number;
}

// Common Thai delivery destinations. `km` is a sensible default; when the farm GPS is
// known we refine it with a haversine estimate × a road factor. Editable.
export const DESTINATIONS: Destination[] = [
  { name: "กรุงเทพฯ", province: "กรุงเทพมหานคร", km: 785, lat: 13.7563, lng: 100.5018 },
  { name: "เชียงใหม่", province: "เชียงใหม่", km: 95, lat: 18.7883, lng: 98.9853 },
  { name: "เชียงราย", province: "เชียงราย", km: 30, lat: 19.9105, lng: 99.8406 },
  { name: "พะเยา", province: "พะเยา", km: 95, lat: 19.1665, lng: 99.9003 },
  { name: "ขอนแก่น", province: "ขอนแก่น", km: 480, lat: 16.4419, lng: 102.836 },
  { name: "นครราชสีมา", province: "นครราชสีมา", km: 615, lat: 14.9799, lng: 102.0977 },
  { name: "ชลบุรี", province: "ชลบุรี", km: 870, lat: 13.3611, lng: 100.9847 },
  { name: "ภูเก็ต", province: "ภูเก็ต", km: 1650, lat: 7.8804, lng: 98.3923 },
  { name: "หาดใหญ่", province: "สงขลา", km: 1580, lat: 7.0086, lng: 100.4747 },
];

const ROAD_FACTOR = 1.3; // straight-line → road distance fudge factor

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Estimate transport distance to a destination. Uses farm GPS + haversine when given,
// otherwise the destination's default `km`. Returns null for unknown destinations.
export function estimateDistanceKm(
  destination: string,
  origin?: { lat: number; lng: number },
): number | null {
  const q = destination.trim();
  if (!q) return null;
  const hit = DESTINATIONS.find(
    (d) => d.name === q || d.province === q || q.includes(d.name),
  );
  if (!hit) return null;
  if (origin && origin.lat && origin.lng) {
    return Math.round(haversineKm(origin.lat, origin.lng, hit.lat, hit.lng) * ROAD_FACTOR);
  }
  return hit.km;
}

const THAI_PROVINCES = DESTINATIONS.map((d) => d.province);

// Best-effort province from a free-text Thai address (looks for "จ.XXX" then a known name).
export function provinceFromAddress(address: string): string {
  const m = address.match(/จ\.?\s*([฀-๿]+)/);
  if (m) return m[1];
  const hit = THAI_PROVINCES.find((p) => address.includes(p));
  return hit ?? "";
}
