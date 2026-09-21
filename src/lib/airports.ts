// Airports for the international air-freight leg: Thai origin airports + common export
// destinations for fresh flowers / fruit. Great-circle distance (DEFRA factors already carry
// the 8% routing uplift, so no extra uplift here).
import { haversineKm } from "./geo";

export interface Airport { code: string; name: string; city: string; country: string; lat: number; lng: number }

export const ORIGIN_AIRPORTS: Airport[] = [
  { code: "BKK", name: "สุวรรณภูมิ", city: "กรุงเทพฯ", country: "ไทย", lat: 13.69, lng: 100.7501 },
  { code: "DMK", name: "ดอนเมือง", city: "กรุงเทพฯ", country: "ไทย", lat: 13.9126, lng: 100.6068 },
  { code: "CNX", name: "เชียงใหม่", city: "เชียงใหม่", country: "ไทย", lat: 18.7668, lng: 98.9626 },
  { code: "CEI", name: "แม่ฟ้าหลวง เชียงราย", city: "เชียงราย", country: "ไทย", lat: 19.9523, lng: 99.8829 },
  { code: "HKT", name: "ภูเก็ต", city: "ภูเก็ต", country: "ไทย", lat: 8.1132, lng: 98.3169 },
  { code: "HDY", name: "หาดใหญ่", city: "สงขลา", country: "ไทย", lat: 6.9332, lng: 100.3927 },
];

export const DEST_AIRPORTS: Airport[] = [
  { code: "NRT", name: "Narita", city: "โตเกียว", country: "ญี่ปุ่น", lat: 35.772, lng: 140.3929 },
  { code: "HND", name: "Haneda", city: "โตเกียว", country: "ญี่ปุ่น", lat: 35.5494, lng: 139.7798 },
  { code: "KIX", name: "Kansai", city: "โอซาก้า", country: "ญี่ปุ่น", lat: 34.4347, lng: 135.244 },
  { code: "ICN", name: "Incheon", city: "โซล", country: "เกาหลีใต้", lat: 37.4602, lng: 126.4407 },
  { code: "PVG", name: "Pudong", city: "เซี่ยงไฮ้", country: "จีน", lat: 31.1443, lng: 121.8083 },
  { code: "PEK", name: "Capital", city: "ปักกิ่ง", country: "จีน", lat: 40.0799, lng: 116.6031 },
  { code: "CAN", name: "Baiyun", city: "กวางโจว", country: "จีน", lat: 23.3924, lng: 113.2988 },
  { code: "KMG", name: "Changshui", city: "คุนหมิง", country: "จีน", lat: 25.1019, lng: 102.9292 },
  { code: "HKG", name: "Hong Kong", city: "ฮ่องกง", country: "ฮ่องกง", lat: 22.308, lng: 113.9185 },
  { code: "TPE", name: "Taoyuan", city: "ไทเป", country: "ไต้หวัน", lat: 25.0797, lng: 121.2342 },
  { code: "SIN", name: "Changi", city: "สิงคโปร์", country: "สิงคโปร์", lat: 1.3644, lng: 103.9915 },
  { code: "KUL", name: "KLIA", city: "กัวลาลัมเปอร์", country: "มาเลเซีย", lat: 2.7456, lng: 101.7072 },
  { code: "CGK", name: "Soekarno-Hatta", city: "จาการ์ตา", country: "อินโดนีเซีย", lat: -6.1256, lng: 106.6559 },
  { code: "MNL", name: "Ninoy Aquino", city: "มะนิลา", country: "ฟิลิปปินส์", lat: 14.5086, lng: 121.0194 },
  { code: "SGN", name: "Tan Son Nhat", city: "โฮจิมินห์", country: "เวียดนาม", lat: 10.8188, lng: 106.6519 },
  { code: "HAN", name: "Noi Bai", city: "ฮานอย", country: "เวียดนาม", lat: 21.2212, lng: 105.8072 },
  { code: "RGN", name: "Yangon", city: "ย่างกุ้ง", country: "เมียนมา", lat: 16.9073, lng: 96.1332 },
  { code: "DEL", name: "Indira Gandhi", city: "นิวเดลี", country: "อินเดีย", lat: 28.5562, lng: 77.1 },
  { code: "BOM", name: "Chhatrapati Shivaji", city: "มุมไบ", country: "อินเดีย", lat: 19.0896, lng: 72.8656 },
  { code: "DXB", name: "Dubai", city: "ดูไบ", country: "สหรัฐอาหรับเอมิเรตส์", lat: 25.2532, lng: 55.3657 },
  { code: "DOH", name: "Hamad", city: "โดฮา", country: "กาตาร์", lat: 25.2731, lng: 51.6081 },
  { code: "RUH", name: "King Khalid", city: "ริยาด", country: "ซาอุดีอาระเบีย", lat: 24.9576, lng: 46.6988 },
  { code: "AMS", name: "Schiphol", city: "อัมสเตอร์ดัม", country: "เนเธอร์แลนด์", lat: 52.3105, lng: 4.7683 },
  { code: "LHR", name: "Heathrow", city: "ลอนดอน", country: "สหราชอาณาจักร", lat: 51.47, lng: -0.4543 },
  { code: "CDG", name: "Charles de Gaulle", city: "ปารีส", country: "ฝรั่งเศส", lat: 49.0097, lng: 2.5479 },
  { code: "FRA", name: "Frankfurt", city: "แฟรงก์เฟิร์ต", country: "เยอรมนี", lat: 50.0379, lng: 8.5622 },
  { code: "SYD", name: "Kingsford Smith", city: "ซิดนีย์", country: "ออสเตรเลีย", lat: -33.9399, lng: 151.1753 },
  { code: "MEL", name: "Tullamarine", city: "เมลเบิร์น", country: "ออสเตรเลีย", lat: -37.669, lng: 144.841 },
  { code: "LAX", name: "Los Angeles", city: "ลอสแอนเจลิส", country: "สหรัฐอเมริกา", lat: 33.9416, lng: -118.4085 },
  { code: "JFK", name: "John F. Kennedy", city: "นิวยอร์ก", country: "สหรัฐอเมริกา", lat: 40.6413, lng: -73.7781 },
];

export const airportLabel = (a: Airport) => `${a.city}, ${a.country} (${a.code})`;
export const findAirport = (code?: string | null) =>
  code ? [...ORIGIN_AIRPORTS, ...DEST_AIRPORTS].find((a) => a.code === code) : undefined;

/** Great-circle flight distance between two airport codes (km, rounded). 0 when unknown. */
export function flightDistanceKm(from?: string | null, to?: string | null): number {
  const a = findAirport(from);
  const b = findAirport(to);
  return a && b ? Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng)) : 0;
}

/** Road distance from a farm to its origin airport (great-circle × 1.3 road factor). */
export function roadToAirportKm(farm: { gpsLat?: number; gpsLng?: number }, code: string): number {
  const a = findAirport(code);
  if (!a || !farm.gpsLat || !farm.gpsLng) return 0;
  return Math.round(haversineKm(farm.gpsLat, farm.gpsLng, a.lat, a.lng) * 1.3);
}
