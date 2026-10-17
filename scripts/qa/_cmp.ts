import fs from "fs";
import data from "../../src/lib/tambon-data.json";
import { REGIONS } from "../../src/lib/places";
const DIR = "D:/Temp/claude/D--/fe35e4a5-df1c-4cc5-9381-c695952be608/scratchpad/zip/";
const csv = (f: string) => fs.readFileSync(DIR + f, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(","));
const all = csv("g0.csv");
const tabs: Record<string, string> = { "1752836046": "?", "1239465008": "?", "215392351": "?", "1476384127": "?", "974494253": "?", "1828357635": "?" };
console.log("rows", all.length, "cols", all[0].length, "provinces", new Set(all.map((r) => r[0])).size, "districts", new Set(all.map((r) => r[0] + "|" + r[1])).size);
for (const g of Object.keys(tabs)) {
  const provs = [...new Set(csv(`g${g}.csv`).map((r) => r[0]))];
  const mine = REGIONS.find((x) => provs.every((p) => x.provinces.includes(p)) && x.provinces.length === provs.length);
  console.log(g, provs.length, "provinces →", mine ? mine.name : "NO MATCH: " + provs.filter((p) => !REGIONS.some((x) => x.provinces.includes(p))).join(","));
}
const tabRows = Object.keys(tabs).reduce((n, g) => n + csv(`g${g}.csv`).length, 0);
console.log("rows in region tabs", tabRows);
// compare with the offline list
const { p, d, s } = data as unknown as { p: string[]; d: [string, number][]; s: [string, number, number, number, string][] };
const mineMap = new Map(s.map(([sub, di, , , zip]) => [`${p[d[di][1]]}|${d[di][0]}|${sub}`, zip]));
const theirs = new Map(all.map((r) => [`${r[0]}|${r[1]}|${r[2]}`, r[3]]));
let same = 0, diffZip = 0; const onlyTheirs: string[] = [], onlyMine: string[] = [], zipDiff: string[] = [];
for (const [k, z] of theirs) { const m = mineMap.get(k); if (m == null) onlyTheirs.push(k); else if (m === z) same++; else { diffZip++; if (zipDiff.length < 12) zipDiff.push(`${k} theirs ${z} mine ${m}`); } }
for (const k of mineMap.keys()) if (!theirs.has(k)) onlyMine.push(k);
console.log({ theirs: theirs.size, mine: mineMap.size, same, diffZip, onlyTheirs: onlyTheirs.length, onlyMine: onlyMine.length });
console.log("zip differs:", zipDiff);
console.log("only theirs:", onlyTheirs.slice(0, 15));
console.log("only mine:", onlyMine.slice(0, 15));
const dupKeys = all.length - theirs.size; console.log("duplicate rows in theirs:", dupKeys);
