// Offline address → subdistrict matching (13 Oct 2026, distance from the real recipient address), the
// recipient-pin parser, and a sweep of every ตำบล written four ways. Pure; no server needed.
//   npx tsx --tsconfig tsconfig.json scripts/qa/tambon-check.ts
import { lookupTambon } from "../../src/lib/tambon";
import { parseLatLng, isShortMapsLink } from "../../src/lib/latlng";
import data from "../../src/lib/tambon-data.json";
const cases: [string, string, string][] = [
  ["123 ม.1 ต.แม่สลองนอก อ.แม่ฟ้าหลวง จ.เชียงราย 57110", "subdistrict", "แม่สลองนอก"],
  ["123 หมู่ 1 แม่สลองนอก แม่ฟ้าหลวง เชียงราย 57110", "subdistrict", "แม่สลองนอก"],
  ["99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110", "subdistrict", "คลองเตย คลองเตย"],
  ["50 ซอยสุขุมวิท 21 คลองเตยเหนือ วัฒนา กทม 10110", "subdistrict", "คลองเตยเหนือ"],
  ["321/12 หมู่ 5 ถนนเชียงใหม่-ลำพูน ตำบลช้างคลาน อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50100", "subdistrict", "ช้างคลาน"],
  ["ต.ช้างคลาน อ.เมือง จ.เชียงใหม่", "subdistrict", "ช้างคลาน"],
  ["88 หมู่ 5 แม่งอน ฝาง เชียงใหม่ 50320", "subdistrict", "แม่งอน"],
  ["เลขที่ 5 ซอย 3 ถนนนิมมานเหมินท์ สุเทพ เมือง เชียงใหม่ 50200", "subdistrict", "สุเทพ"],
  ["111 ถนนพหลโยธิน สามเสนใน พญาไท กรุงเทพมหานคร 10400", "subdistrict", "สามเสนใน"],
  ["บ้านเลขที่ 7 อ.เมือง ขอนแก่น", "district", "เมืองขอนแก่น"],
  ["บ้านเลขที่ 7 ขอนแก่น", "none", ""],
  ["55 หมู่ 3 ต.ริมใต้ อ.แม่ริม เชียงใหม่", "subdistrict", "ริมใต้"],
  ["99 ต.หนองหาร อ.สันทราย จ.เชียงใหม่ 50290", "subdistrict", "หนองหาร"],
  ["ต.สีลม อ.บางรัก จ.กรุงเทพมหานคร", "subdistrict", "สีลม"],
  ["แขวงสีลม เขตบางรัก กทม.", "subdistrict", "สีลม"],
  ["ต.บ้านบาตร อ.ป้อมปราบศัตรูพ่าย จ.กรุงเทพมหานคร", "subdistrict", "บ้านบาตร"],
  ["ต.นาอ้อ อ.เมืองเลย จ.เลย", "subdistrict", "นาอ้อ"],
  ["หมู่ 4 บ้านแม่สลอง ต.แม่สลองใน อ.แม่ฟ้าหลวง จ.เชียงราย", "subdistrict", "แม่สลองใน"],
  ["99 ม.1 ต.แม่โถ อ.แม่ลาน้อย จ.แม่ฮ่องสอน 58120", "subdistrict", "แม่โถ"],
  ["99 ม.1 ผึ่งแดด มุกดาหาร 49000", "subdistrict", "ผึ่งแดด"],
  ["ต.แม่สลองนอก จ.เชียงราย", "subdistrict", "แม่สลองนอก"],
  ["ต.ในเมือง อ.พิมาย จ.นครราชสีมา", "subdistrict", "ในเมือง พิมาย"],
  ["ต.บ้านใหม่ จ.นครราชสีมา", "none", ""],
  ["ต.ขอนแก่น อ.เมืองร้อยเอ็ด จ.ร้อยเอ็ด", "subdistrict", "ขอนแก่น เมืองร้อยเอ็ด"],
  ["ต.คีรีเขต อ.ธารโต จ.ยะลา", "subdistrict", "คีรีเขต"],
  // road, soi, village and shop names are full of other places' names
  ["99 ถ.เชียงใหม่-ลำพูน ต.หนองหอย อ.เมือง จ.เชียงใหม่ 50000", "subdistrict", "หนองหอย เมืองเชียงใหม่"],
  ["12/3 ซ.ลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพฯ 10310", "subdistrict", "สะพานสอง วังทองหลาง"],
  ["12/3 ซ.ลาดพร้าว 71 สะพานสอง วังทองหลาง กรุงเทพฯ 10310", "subdistrict", "สะพานสอง วังทองหลาง"],
  ["99 ถ.บางนา-ตราด ต.บางแก้ว อ.บางพลี 10540", "subdistrict", "บางแก้ว บางพลี สมุทรปราการ"],
  ["99 ถ.บางนา-ตราด กม.7 บางแก้ว บางพลี สมุทรปราการ 10540", "subdistrict", "บางแก้ว บางพลี"],
  ["100 ถ.สาทรเหนือ สีลม บางรัก กทม 10500", "subdistrict", "สีลม บางรัก"],
  ["หมู่ 4 บ้านป่าแดด ท่าก๊อ แม่สรวย เชียงราย 57180", "subdistrict", "ท่าก๊อ แม่สรวย"],
  ["บริษัท เชียงใหม่ฟลาวเวอร์ จำกัด 55 ต.ช้างเผือก อ.เมือง จ.เชียงใหม่", "subdistrict", "ช้างเผือก เมืองเชียงใหม่"],
  ["12 แขวงถนนพญาไท เขตราชเทวี กรุงเทพฯ 10400", "subdistrict", "ถนนพญาไท ราชเทวี"],
  ["12 ถนนพญาไท แขวงทุ่งพญาไท เขตราชเทวี กรุงเทพฯ 10400", "subdistrict", "ทุ่งพญาไท ราชเทวี"],
  ["12 ม.3 ต.ถนนใหญ่ อ.เมืองลพบุรี จ.ลพบุรี", "subdistrict", "ถนนใหญ่ เมืองลพบุรี"],
  // glued together, a postcode from another province, a ตำบล with dots in its name
  ["ต.บ้านดู่อ.เมืองจ.เชียงราย", "subdistrict", "บ้านดู่ เมืองเชียงราย"],
  ["ต.เวียง อ.เมือง เชียงราย 50000", "subdistrict", "เวียง เมืองเชียงราย"],
  ["ต.ท่าศาลา อ.เมือง ลพบุรี 50000", "subdistrict", "ท่าศาลา เมืองลพบุรี"],
  ["12 ม.3 ต.จ.ป.ร. อ.กระบุรี จ.ระนอง", "subdistrict", "จ.ป.ร. กระบุรี"],
  ["ม.5 ต.ป่าแดด อ.ป่าแดด จ.เชียงราย 57190", "subdistrict", "ป่าแดด ป่าแดด"],
  ["123 Sukhumvit Rd, Khlong Toei, Bangkok 10110", "none", ""],
];
let bad = 0;
for (const [addr, want, name] of cases) {
  const h = lookupTambon(addr);
  const ok = want === "none" ? !h : !!h && h.precision === want && h.label.startsWith(name);
  if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", (h ? `${h.precision} ${h.label} ${h.lat},${h.lng}` : "none").padEnd(60), "|", addr.slice(0, 50));
}
// the pin: plain coordinates and the Google Maps link shapes that carry the point
const pins: [string, string | null][] = [
  ["13.7367, 100.5602", "13.7367,100.5602"],
  ["13.7367 100.5602", "13.7367,100.5602"],
  ["https://www.google.com/maps/@13.7367,100.5602,17z", "13.7367,100.5602"],
  ["https://www.google.com/maps/place/13.7367,100.5602", "13.7367,100.5602"],
  ["https://www.google.com/maps/search/13.7367,+100.5602?entry=tts", "13.7367,100.5602"],
  ["https://maps.google.com/?q=13.7367,100.5602", "13.7367,100.5602"],
  ["https://www.google.com/maps/search/?api=1&query=13.7367%2C100.5602", "13.7367,100.5602"],
  ["https://www.google.com/maps/place/Wat/@13.70,100.50,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d13.7515!4d100.4927", "13.7515,100.4927"],
  ["https://maps.app.goo.gl/AbCdEf123", null],
  ["123 ม.1", null],
];
for (const [v, want] of pins) {
  const p = parseLatLng(v); const got = p ? `${p.lat},${p.lng}` : null; const ok = got === want;
  if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", String(got).padEnd(60), "|", v.slice(0, 50));
}
const shortOk = isShortMapsLink("https://maps.app.goo.gl/AbC") && isShortMapsLink("https://goo.gl/maps/AbC") && !isShortMapsLink("https://evil.example/maps.app.goo.gl/x");
if (!shortOk) bad++;
console.log(shortOk ? "PASS" : "FAIL", "short share links are recognised (only Google's hosts)");

// every subdistrict, written four ways, must come back as itself (or nothing — never a wrong one)
const { p, d, s: subs } = data as unknown as { p: string[]; d: [string, number][]; s: [string, number, number, number, string][] };
const forms: [string, (a: string, b: string, c: string, z: string) => string, number][] = [
  ["ต./อ./จ.", (a, b, c) => (c === "กรุงเทพมหานคร" ? `12 แขวง${a} เขต${b} กรุงเทพฯ` : `12 ม.3 ต.${a} อ.${b} จ.${c}`), 0],
  ["no prefixes + postcode", (a, b, c, z) => `12 หมู่ 3 ${a} ${b} ${c} ${z}`, 0],
  ["ต. + จ. only", (a, _b, c) => (c === "กรุงเทพมหานคร" ? `แขวง${a} กรุงเทพฯ` : `ต.${a} จ.${c}`), 0],
  ["ต. + postcode", (a, _b, _c, z) => `ต.${a} ${z}`, 0],
];
for (const [name, f, maxWrong] of forms) {
  let okN = 0, wrong = 0, none = 0;
  for (const [sub, di, , , zip] of subs) {
    const [dist, pi] = d[di]; const prov = p[pi];
    const h = lookupTambon(f(sub, dist, prov, zip));
    if (!h) none++; else if (h.precision === "subdistrict" && h.label === `${sub} ${dist} ${prov}`) okN++; else wrong++;
  }
  const ok = wrong <= maxWrong;
  if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", `sweep ${name}: ${okN}/${subs.length} right, ${wrong} wrong, ${none} left to Nominatim`);
}
console.log(bad ? `${bad} failed` : "all passed");
