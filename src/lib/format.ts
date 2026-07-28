// Thai date/number formatting helpers. Dates are rendered in Asia/Bangkok (UTC+7)
// regardless of server timezone, so timestamps match the operator's wall clock.

export const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function thaiMonthShort(m: number): string {
  return THAI_MONTHS[m] ?? "";
}

// Break an ISO datetime OR a YYYY-MM-DD date into Bangkok wall-clock parts.
function parts(iso: string): { y: number; mo: number; d: number; h: number; mi: number } | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, mo, d] = iso.split("-").map(Number);
    return { y, mo: mo - 1, d, h: 0, mi: 0 };
  }
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const b = new Date(t.getTime() + 7 * 3600 * 1000);
  return {
    y: b.getUTCFullYear(),
    mo: b.getUTCMonth(),
    d: b.getUTCDate(),
    h: b.getUTCHours(),
    mi: b.getUTCMinutes(),
  };
}

// "26 ก.ค."
export function thaiDateShort(iso: string): string {
  const p = parts(iso);
  return p ? `${p.d} ${THAI_MONTHS[p.mo]}` : iso;
}

// "26 ก.ค. 14:32"
export function thaiDateTime(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  const hh = String(p.h).padStart(2, "0");
  const mi = String(p.mi).padStart(2, "0");
  return `${p.d} ${THAI_MONTHS[p.mo]} ${hh}:${mi}`;
}

// True when two ISO/date values fall on the same Bangkok calendar day.
export function isSameBangkokDay(a: string, b: string): boolean {
  const pa = parts(a);
  const pb = parts(b);
  return !!pa && !!pb && pa.y === pb.y && pa.mo === pb.mo && pa.d === pb.d;
}

// Aggregate items into the last `n` monthly buckets ending at `refIso` (or today).
export function buildMonthSeries<T>(
  items: T[],
  dateOf: (t: T) => string,
  valueOf: (t: T) => number,
  n = 5,
  refIso?: string,
): { label: string; value: number }[] {
  let refY: number;
  let refM: number;
  const refP = refIso ? parts(refIso) : null;
  if (refP) {
    refY = refP.y;
    refM = refP.mo;
  } else {
    const b = new Date(Date.now() + 7 * 3600 * 1000);
    refY = b.getUTCFullYear();
    refM = b.getUTCMonth();
  }
  const buckets: { y: number; m: number; value: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let m = refM - i;
    let y = refY;
    while (m < 0) {
      m += 12;
      y--;
    }
    buckets.push({ y, m, value: 0 });
  }
  for (const it of items) {
    const p = parts(dateOf(it));
    if (!p) continue;
    const bk = buckets.find((b) => b.y === p.y && b.m === p.mo);
    if (bk) bk.value += valueOf(it);
  }
  return buckets.map((b) => ({ label: thaiMonthShort(b.m), value: Math.round(b.value) }));
}
