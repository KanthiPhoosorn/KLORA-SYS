// Offline placement of a Thai address at subdistrict (ตำบล/แขวง) level — server only (13 Oct 2026: the
// transport distance must come from the recipient's real address, not the province). Data: Thailand
// Canonical Administrative-Names Reference, CC BY 4.0 — data/master/tambon/README.md.
//
// Works with or without the ต./อ./จ./แขวง/เขต prefixes. Road and soi names are dropped, the address is cut
// into its words, and a place name counts only as a whole word ("สิงห์" is not read inside "สิงห์บุรี", nor
// "แม่สลอง" inside "บ้านแม่สลองนอก"). A subdistrict is accepted when its district or its postcode is there
// too, or when it is the only one of that name in the address's province (typed after ต./แขวง, or not a
// short name) — a bare name like "นา" is too common to trust alone. A district or province name in the
// address is not read as a subdistrict as well: 591 districts have a ตำบล of the same name (the district
// seat), and "ต.สีลม อ.บางรัก" must give สีลม, not บางรัก; "อ.แกลง จ.ระยอง" is the district, not ต.แกลง of
// another district. Failing that, a matching district → its centre. A wrong ตำบล is worse than none: when
// in doubt this returns null and the caller asks Nominatim.
import data from "./tambon-data.json";

type Compact = { p: string[]; d: [string, number, number | null, number | null][]; s: [string, number, number, number, string][] };
const { p: PROV, d: DIST, s: SUB } = data as unknown as Compact;
const ROWS = SUB.map(([sub, di, lat, lng, zip]) => ({ sub, di, dist: DIST[di][0], prov: PROV[DIST[di][1]], lat, lng, zip }));
type Row = (typeof ROWS)[number];
type Span = [number, number];
/** how many subdistricts of a province share a name */
const NAME_COUNT = new Map<string, number>();
for (const r of ROWS) NAME_COUNT.set(`${r.prov}|${r.sub}`, (NAME_COUNT.get(`${r.prov}|${r.sub}`) ?? 0) + 1);
const SUB_NAMES = new Set(ROWS.map((r) => r.sub));
/** "province|district" for every district */
const DIST_IN_PROV = new Set(DIST.map(([name, pi]) => `${PROV[pi]}|${name}`));

export interface TambonHit { lat: number; lng: number; precision: "subdistrict" | "district"; label: string }

const TH = "\\u0E00-\\u0E7F";
const BKK = /กรุงเทพฯ|กรุงเทพ(?!มหานคร)|กทม\.?|bangkok/gi;
const isThai = (ch: string | undefined) => !!ch && ch >= "฀" && ch <= "๿";

/** Road and soi names out ("ถ.เชียงใหม่-ลำพูน", "ซ.ลาดพร้าว 71", "ถนนสุขุมวิท") — they are full of place names
 *  that are not where the recipient is. A ตำบล that is itself called ถนน… (ถนนใหญ่, แขวงถนนพญาไท) stays. */
function clean(address: string): string {
  return address
    .replace(BKK, "กรุงเทพมหานคร")
    .replace(new RegExp(`(?<!(?:ตำบล|ต\\.|แขวง)\\s*)(?<![${TH}])(ถนน|ถ\\.|ซอย|ซ\\.)\\s*([^\\s,]+)`, "g"), (m, kind: string, name: string) =>
      (kind === "ถนน" || kind === "ซอย") && SUB_NAMES.has(kind + name) ? m : " ");
}

/** The address without its prefixes, spaces and commas — and the places where two words were joined.
 *  "123 ม.1 ต.แม่สลองนอก อ.แม่ฟ้าหลวง จ.เชียงราย" → "123ม.1แม่สลองนอกแม่ฟ้าหลวงเชียงราย", cuts at 3, 6, 17, 27 */
function pieces(text: string): { flat: string; cuts: Set<number> } {
  // ต.จ.ป.ร. (กระบุรี) is a name, not three prefixes
  const drop = new RegExp(`(?:(?<![${TH}])(?:ตำบล|แขวง|อำเภอ|เขต|จังหวัด)|ต\\.|อ\\.|จ\\.(?!ป\\.ร\\.))\\s*|[\\s,]+`, "g");
  const cuts = new Set<number>();
  let flat = "", last = 0;
  for (const m of text.matchAll(drop)) {
    flat += text.slice(last, m.index);
    cuts.add(flat.length);
    last = m.index + m[0].length;
  }
  return { flat: flat + text.slice(last), cuts };
}
export const flatten = (address: string) => pieces(address.replace(BKK, "กรุงเทพมหานคร")).flat;

/** the name typed after a prefix, e.g. ("…ต.แม่สลองใน อ.แม่ฟ้าหลวง", "ตำบล|แขวง", "ต") → "แม่สลองใน" */
function typed(address: string, words: string, letter: string): string | undefined {
  // ends at a space, a digit or the next dotted prefix — not at เขต/ตำบล, which are inside names (คีรีเขต, สามตำบล)
  const re = new RegExp(`(?:(?:^|[^${TH}])(?:${words})|${letter}\\.)\\s*([${TH}-]+?)(?=[\\s,\\d]|[ตอจ]\\.|$)`);
  return re.exec(address)?.[1];
}

const overlaps = (i: number, len: number, [a, b]: Span) => i < b && a < i + len;

export function lookupTambon(address: string): TambonHit | null {
  const text = clean(address);
  const { flat, cuts } = pieces(text);
  if (flat.length < 4) return null;
  // every place `name` stands as a whole word
  const at = (name: string): number[] => {
    const out: number[] = [];
    for (let i = flat.indexOf(name); i >= 0; i = flat.indexOf(name, i + 1)) {
      const end = i + name.length;
      if ((i === 0 || cuts.has(i) || !isThai(flat[i - 1])) && (end === flat.length || cuts.has(end) || !isThai(flat[end]))) out.push(i);
    }
    return out;
  };
  const spanOf = (name: string | undefined): Span | null => { const i = name ? at(name)[0] : undefined; return i == null ? null : [i, i + name!.length]; };
  const zip = /(?:^|\D)(\d{5})(?!\d)/.exec(text)?.[1];
  const tSub = typed(text, "ตำบล|แขวง", "ต");
  const tDist = typed(text, "อำเภอ|เขต", "อ");
  // the words typed as ตำบล and as อำเภอ are that and nothing else ("ต.สระแก้ว" is not จ.สระแก้ว, "อ.แกลง" not ต.แกลง)
  const subSpan = spanOf(tSub);
  const distSpan = spanOf(tDist);
  const free = (name: string) => at(name).filter((i) => !subSpan || !overlaps(i, name.length, subSpan));
  // the province: the one typed after จ./จังหวัด, else the name written last ("ต.ขอนแก่น … ร้อยเอ็ด" is in ร้อยเอ็ด)
  let prov = typed(text, "จังหวัด", "จ");
  if (prov && (!PROV.includes(prov) || !free(prov).length)) prov = undefined;
  if (!prov) {
    let end = -1;
    for (const n of PROV) {
      const i = free(n).pop();
      if (i != null && i + n.length > end) { prov = n; end = i + n.length; }
    }
  }
  const provAt = prov ? free(prov).pop() : undefined;
  const provSpan: Span | null = provAt != null ? [provAt, provAt + prov!.length] : null;
  // where the district is written — the word that is the province does not count (อ.พระนครศรีอยุธยา vs จ.พระนครศรีอยุธยา)
  const distAt = (r: Row) => free(r.dist).filter((i) => !provSpan || !overlaps(i, r.dist.length, provSpan));
  const zipOk = (r: Row) => !!zip && r.zip === zip;
  // "อ.เมือง" / "เมือง" stands for เมือง<province>; "อ.เมืองX" is also written for a district called X
  const bareMuang = free("เมือง").length > 0;
  const muang = (r: Row) => (bareMuang && r.dist === `เมือง${r.prov}` && (r.prov === prov || (!prov && zipOk(r)))) || (!!tDist && tDist === `เมือง${r.dist}` && r.prov === prov);
  const distIn = (r: Row) => distAt(r).length > 0 || muang(r);
  const distTyped = (r: Row) => !!tDist && (tDist === r.dist || muang(r));

  const pool = ROWS.filter((r) => !prov || r.prov === prov);
  const found: { r: Row; score: number; pos: number }[] = [];
  for (const r of pool) {
    if (!flat.includes(r.sub)) continue;
    const named = tSub === r.sub && !!subSpan;
    let own: number[];
    if (named) own = [subSpan![0]];
    else {
      // the last place the district / province names are written belongs to them, not to a subdistrict of the same name
      const d = distAt(r).pop();
      const taken = [provSpan, subSpan, distSpan, d == null ? null : ([d, d + r.dist.length] as Span)].filter((x): x is Span => !!x);
      own = at(r.sub).filter((i) => !taken.some((t) => overlaps(i, r.sub.length, t)));
    }
    if (!own.length) continue;
    const distHit = distIn(r);
    const zipHit = zipOk(r);
    const provHit = r.prov === prov;
    if (!distHit) {
      // without its district: a word that is also a district of the province (or just "เมือง") is read as that district
      const alsoDistrict = !named && (r.sub === "เมือง" || DIST_IN_PROV.has(`${r.prov}|${r.sub}`));
      const onlyOne = provHit && NAME_COUNT.get(`${r.prov}|${r.sub}`) === 1 && (named || r.sub.length >= 4);
      if (alsoDistrict || !(zipHit || onlyOne)) continue;
    }
    // the อำเภอ typed after อ./เขต outweighs a postcode (people mistype postcodes; a landmark may name another district)
    found.push({ r, score: 3 + (named ? 6 : 0) + (distTyped(r) ? 5 : 0) + (distHit ? 2 : 0) + (zipHit ? 4 : 0) + (provHit ? 1 : 0), pos: own[own.length - 1] });
  }
  // best score; then the name written last (a village comes before its ตำบล); then the longer name
  found.sort((a, b) => b.score - a.score || b.pos - a.pos || b.r.sub.length - a.r.sub.length);
  const best = found[0]?.r;
  if (best) return { lat: best.lat, lng: best.lng, precision: "subdistrict", label: `${best.sub} ${best.dist} ${best.prov}` };

  // no subdistrict: a district named in the address (with its province or postcode) → the district centre
  const dists = new Map<number, number>();
  for (const r of pool) if (distIn(r) && (r.prov === prov || zipOk(r))) dists.set(r.di, (distTyped(r) ? 1000 : 0) + r.dist.length);
  const di = [...dists].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (di != null) {
    const [name, pi, lat, lng] = DIST[di];
    if (lat != null && lng != null) return { lat, lng, precision: "district", label: `${name} ${PROV[pi]}` };
  }
  return null;
}
