// Offline placement of a Thai address at subdistrict (ตำบล/แขวง) level — server only (13 Oct 2026: the
// transport distance must come from the recipient's real address, not the province). Data: Thailand
// Canonical Administrative-Names Reference, CC BY 4.0 — data/master/tambon/README.md.
//
// Works with or without the ต./อ./จ./แขวง/เขต prefixes: road and soi names are dropped, the address is
// flattened (prefixes and spaces removed) and each subdistrict whose Thai name appears in it is scored.
// A subdistrict is accepted when its district or its postcode also matches, or when it is the only one of
// that name in the address's province (typed after ต./แขวง, or not a short name) — a bare name like "นา"
// is too common to trust alone. The district and province names in the address are not read as a
// subdistrict too: 591 districts have a ตำบล of the same name (the district seat), and "ต.สีลม อ.บางรัก"
// must give สีลม, not บางรัก. Failing that, a matching district → its centre. A wrong ตำบล is worse than
// none: when in doubt this returns null and the caller asks Nominatim.
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

export interface TambonHit { lat: number; lng: number; precision: "subdistrict" | "district"; label: string }

const TH = "\\u0E00-\\u0E7F";
const BKK = /กรุงเทพฯ|กรุงเทพ(?!มหานคร)|กทม\.?|bangkok/gi;

/** Road and soi names out ("ถ.เชียงใหม่-ลำพูน", "ซ.ลาดพร้าว 71", "ถนนสุขุมวิท") — they are full of place names
 *  that are not where the recipient is. A ตำบล that is itself called ถนน… (ถนนใหญ่, แขวงถนนพญาไท) stays. */
function clean(address: string): string {
  return address
    .replace(BKK, "กรุงเทพมหานคร")
    .replace(new RegExp(`(?<!(?:ตำบล|ต\\.|แขวง)\\s*)(?<![${TH}])(ถนน|ถ\\.|ซอย|ซ\\.)\\s*([^\\s,]+)`, "g"), (m, kind: string, name: string) =>
      (kind === "ถนน" || kind === "ซอย") && SUB_NAMES.has(kind + name) ? m : " ");
}

/** "123 ม.1 ต.แม่สลองนอก อ.แม่ฟ้าหลวง จ.เชียงราย" → "123ม.1แม่สลองนอกแม่ฟ้าหลวงเชียงราย" */
export function flatten(address: string): string {
  return address
    .replace(new RegExp(`(^|[^${TH}])(ตำบล|แขวง|อำเภอ|เขต|จังหวัด)\\s*`, "g"), "$1")
    .replace(/(ต\.|อ\.|จ\.(?!ป\.ร\.))\s*/g, "") // ต.จ.ป.ร. (กระบุรี) is a name
    .replace(BKK, "กรุงเทพมหานคร")
    .replace(/[\s,]+/g, "");
}

/** the name typed after a prefix, e.g. ("…ต.แม่สลองใน อ.แม่ฟ้าหลวง", "ตำบล|แขวง", "ต") → "แม่สลองใน" */
function typed(address: string, words: string, letter: string): string | undefined {
  // ends at a space, a digit or the next dotted prefix — not at เขต/ตำบล, which are inside names (คีรีเขต, สามตำบล)
  const re = new RegExp(`(?:(?:^|[^${TH}])(?:${words})|${letter}\\.)\\s*([${TH}-]+?)(?=[\\s,\\d]|[ตอจ]\\.|$)`);
  return re.exec(address)?.[1];
}

/** every index where `name` occurs in `flat` */
function at(flat: string, name: string): number[] {
  const out: number[] = [];
  for (let i = flat.indexOf(name); i >= 0; i = flat.indexOf(name, i + 1)) out.push(i);
  return out;
}
const overlaps = (i: number, len: number, [a, b]: Span) => i < b && a < i + len;
const inside = (i: number, len: number, [a, b]: Span) => a <= i && i + len <= b;

export function lookupTambon(address: string): TambonHit | null {
  const text = clean(address);
  const flat = flatten(text);
  if (flat.length < 4) return null;
  const zip = /(?:^|\D)(\d{5})(?!\d)/.exec(text)?.[1];
  const tSub = typed(text, "ตำบล|แขวง", "ต");
  const tDist = typed(text, "อำเภอ|เขต", "อ");
  // where the typed ตำบล is written — no other name is read inside it ("ต.บ้านใหม่" is not ต.ใหม่, "ต.สระแก้ว" not จ.สระแก้ว)
  const subAt = tSub ? flat.indexOf(tSub) : -1;
  const subSpan: Span | null = subAt >= 0 ? [subAt, subAt + tSub!.length] : null;
  const free = (name: string) => at(flat, name).filter((i) => !subSpan || !overlaps(i, name.length, subSpan));
  // the province: the one typed after จ./จังหวัด, else the name written last ("ต.ขอนแก่น … ร้อยเอ็ด" is in ร้อยเอ็ด)
  let prov = typed(text, "จังหวัด", "จ");
  if (prov && (!PROV.includes(prov) || !free(prov).length)) prov = undefined;
  if (!prov) {
    let end = -1;
    for (const n of PROV) {
      const i = free(n).pop();
      if (i != null && (i + n.length > end || (i + n.length === end && n.length > prov!.length))) { prov = n; end = i + n.length; }
    }
  }
  const provAt = prov ? free(prov).pop() : undefined;
  const provSpan: Span | null = provAt != null ? [provAt, provAt + prov!.length] : null;
  // where the district is written — not inside the province name (อ.พระนครศรีอยุธยา vs จ.พระนครศรีอยุธยา) or the typed ตำบล
  const distAt = (r: Row) => free(r.dist).filter((i) => !provSpan || !inside(i, r.dist.length, provSpan));
  const zipOk = (r: Row) => !!zip && r.zip === zip;
  // "อ.เมือง" stands for เมือง<province>
  const distIn = (r: Row) => distAt(r).length > 0 || (tDist === "เมือง" && r.dist === `เมือง${r.prov}` && (r.prov === prov || (!prov && zipOk(r))));

  const bestSub = (pool: Row[]): Row | null => {
    const found: { r: Row; score: number; pos: number }[] = [];
    for (const r of pool) {
      if (!flat.includes(r.sub)) continue;
      const named = tSub === r.sub;
      // the last place the district / province names are written belongs to them, not to a subdistrict of the same name
      const d = distAt(r).pop();
      const taken = [provSpan, subSpan, d == null ? null : ([d, d + r.dist.length] as Span)].filter((x): x is Span => !!x);
      const own = named ? [subAt] : at(flat, r.sub).filter((i) => !taken.some((t) => overlaps(i, r.sub.length, t)));
      if (!own.length) continue;
      const distHit = distIn(r);
      const zipHit = zipOk(r);
      const provHit = r.prov === prov;
      if (!distHit && !zipHit && !(provHit && NAME_COUNT.get(`${r.prov}|${r.sub}`) === 1 && (named || r.sub.length >= 4))) continue;
      found.push({ r, score: 3 + (named ? 6 : 0) + (tDist && distHit ? 1 : 0) + (distHit ? 2 : 0) + (zipHit ? 4 : 0) + (provHit ? 1 : 0), pos: own[own.length - 1] });
    }
    // a name written inside a longer one that also fits is not there by itself (คลองเตย in คลองเตยเหนือ)
    const alone = found.filter((a) => !found.some((b) => b.r.sub.length > a.r.sub.length && inside(a.pos, a.r.sub.length, [b.pos, b.pos + b.r.sub.length])));
    // best score; then the name written last (a village comes before its ตำบล); then the longer name
    alone.sort((a, b) => b.score - a.score || b.pos - a.pos || b.r.sub.length - a.r.sub.length);
    return alone[0]?.r ?? null;
  };
  // no subdistrict: a district named in the address (with its province or postcode) → the district centre
  const bestDist = (pool: Row[]): number | null => {
    const dists = new Map<number, number>();
    for (const r of pool) if (distIn(r) && (r.prov === prov || zipOk(r))) dists.set(r.di, r.dist.length);
    return [...dists].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  const inScope = (r: Row) => !prov || r.prov === prov;
  const scopes = [ROWS.filter((r) => inScope(r) && (!zip || r.zip === zip))];
  if (zip) scopes.push(ROWS.filter(inScope)); // a mistyped postcode
  for (const pool of scopes) {
    const r = bestSub(pool);
    if (r) return { lat: r.lat, lng: r.lng, precision: "subdistrict", label: `${r.sub} ${r.dist} ${r.prov}` };
  }
  for (const pool of scopes) {
    const di = bestDist(pool);
    if (di == null) continue;
    const [name, pi, lat, lng] = DIST[di];
    if (lat != null && lng != null) return { lat, lng, precision: "district", label: `${name} ${PROV[pi]}` };
  }
  return null;
}
