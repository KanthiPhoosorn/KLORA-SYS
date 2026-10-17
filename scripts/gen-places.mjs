// Builds src/lib/places-data.json — the address pickers' list (ภาค → จังหวัด → อำเภอ/เขต → ตำบล/แขวง →
// รหัสไปรษณีย์) — from data/master/postcodes/postcodes-th.csv, the "รหัสไปรษณีย์ (แยกภาค)" sheet KYN gave
// (doc tab "Logistic", 18 Oct 2026). The sheet has no coordinates; where a ตำบล is also in the offline list
// (src/lib/tambon-data.json, CC BY 4.0) its centre is kept so the map picker can open there.
//   node scripts/gen-places.mjs
// Output: { r: [[region, [provinceIdx…]]], p: [province], d: [[district, provinceIdx]], s: [[subdistrict, districtIdx, postcode, lat|null, lng|null]] }
import fs from "node:fs";
import path from "node:path";

const rows = fs.readFileSync(path.resolve("data/master/postcodes/postcodes-th.csv"), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).slice(1).map((l) => l.split(","));
const th = (a, b) => a.localeCompare(b, "th");

// centres from the offline list, by "province|district|subdistrict", then "province|district"
const t = JSON.parse(fs.readFileSync(path.resolve("src/lib/tambon-data.json"), "utf8"));
const subCentre = new Map(t.s.map(([sub, di, lat, lng]) => [`${t.p[t.d[di][1]]}|${t.d[di][0]}|${sub}`, [lat, lng]]));
const distCentre = new Map(t.d.filter((x) => x[2] != null).map(([name, pi, lat, lng]) => [`${t.p[pi]}|${name}`, [lat, lng]]));
const provCentre = new Map(t.d.filter((x) => x[2] != null && x[0].startsWith("เมือง")).map(([, pi, lat, lng]) => [t.p[pi], [lat, lng]]));
provCentre.set("กรุงเทพมหานคร", [13.7563, 100.5018]);

const regionOrder = ["ภาคเหนือ", "ภาคตะวันออกเฉียงเหนือ", "ภาคกลาง", "ภาคตะวันออก", "ภาคตะวันตก", "ภาคใต้"];
const provinces = [...new Set(rows.map((r) => r[1]))].sort(th);
const pIdx = new Map(provinces.map((p, i) => [p, i]));
const regionOf = new Map(rows.map((r) => [r[1], r[0]]));
const regions = regionOrder.map((name) => [name, provinces.filter((p) => regionOf.get(p) === name).map((p) => pIdx.get(p))]);
const extra = [...new Set(rows.map((r) => r[0]))].filter((n) => !regionOrder.includes(n));
if (extra.length) throw new Error(`unknown region ${extra}`);

const districts = [...new Set(rows.map((r) => `${r[1]}|${r[2]}`))].map((k) => k.split("|")).sort((a, b) => th(a[0], b[0]) || th(a[1], b[1]));
const dIdx = new Map(districts.map(([p, d], i) => [`${p}|${d}`, i]));
let withCentre = 0, fromDistrict = 0;
const subs = rows
  .map(([, prov, dist, sub, zip]) => {
    let c = subCentre.get(`${prov}|${dist}|${sub}`);
    if (c) withCentre++;
    else if ((c = distCentre.get(`${prov}|${dist}`))) fromDistrict++;
    else c = provCentre.get(prov); // a district the offline list spells differently → somewhere in the province
    return [sub, dIdx.get(`${prov}|${dist}`), zip, c?.[0] ?? null, c?.[1] ?? null];
  })
  .sort((a, b) => a[1] - b[1] || th(a[0], b[0]));
if (subs.some((s) => !/^\d{5}$/.test(s[2]))) throw new Error("a postcode is not 5 digits");

const out = path.resolve("src/lib/places-data.json");
fs.writeFileSync(out, JSON.stringify({ r: regions, p: provinces, d: districts.map(([p, d]) => [d, pIdx.get(p)]), s: subs }));
console.log(`regions ${regions.map(([n, ps]) => `${n} ${ps.length}`).join(" · ")} | provinces ${provinces.length} · districts ${districts.length} · subdistricts ${subs.length} (centre: own ${withCentre}, district ${fromDistrict}, province ${subs.filter((x) => x[3] != null).length - withCentre - fromDistrict}, none ${subs.filter((x) => x[3] == null).length}) → ${Math.round(fs.statSync(out).size / 1024)} KB`);
