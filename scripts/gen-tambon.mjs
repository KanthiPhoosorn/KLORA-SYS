// Builds src/lib/tambon-data.json from data/master/tambon/adm{1,2,3}.csv (Thailand Canonical
// Administrative-Names Reference, CC BY 4.0 — see data/master/tambon/README.md).
//   node scripts/gen-tambon.mjs
// Output (compact): { p: [province], d: [[district, provinceIdx, lat, lng]], s: [[subdistrict, districtIdx, lat, lng, postcode]] }
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("data/master/tambon");
/** minimal CSV reader (quoted fields with commas / doubled quotes) */
function csv(file) {
  const text = fs.readFileSync(path.join(dir, file), "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const num = (v) => (v === "" || v == null ? null : Math.round(Number(v) * 1e4) / 1e4);

const adm1 = csv("adm1.csv"), adm2 = csv("adm2.csv"), adm3 = csv("adm3.csv");
const provIdx = new Map(), distIdx = new Map();
const p = adm1.map((r, i) => { provIdx.set(r.tis1099_code, i); return r.name_th; });
const d = adm2.map((r, i) => { distIdx.set(r.tis1099_district_code, i); return [r.name_th, provIdx.get(r.parent_province_tis1099_code), num(r.centroid_lat), num(r.centroid_lon)]; });
let fallback = 0, missing = 0;
const s = adm3.map((r) => {
  const di = distIdx.get(r.parent_district_tis1099_code);
  if (di == null) { missing++; return null; }
  let lat = num(r.centroid_lat), lng = num(r.centroid_lon);
  if (lat == null || lng == null) { [, , lat, lng] = d[di]; fallback++; }
  return [r.name_th, di, lat, lng, r.postal_code];
}).filter(Boolean);
if (d.some((x) => x[1] == null)) throw new Error("a district without a province");
const out = path.resolve("src/lib/tambon-data.json");
fs.writeFileSync(out, JSON.stringify({ p, d, s }));
console.log(`provinces ${p.length} · districts ${d.length} · subdistricts ${s.length} (district centroid used for ${fallback}, unjoined ${missing}) → ${Math.round(fs.statSync(out).size / 1024)} KB`);
