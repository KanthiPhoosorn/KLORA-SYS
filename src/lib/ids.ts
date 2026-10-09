// Human-readable IDs (Thai Post doc, 9 Oct 2026 — "เปลี่ยนรหัส"):
//   CID-NNNN       every organisation (farm, sorting centre, carrier, exporter) — role is data, not in the code
//   LOT-YYMM-NNNN  a product lot: created once at the farm, the same code through to the QR
//   PKG-NNNN       a registered reusable package
// The running number is global (max existing + 1); YYMM is the Gregorian year/month in Thai time.
// USR-, PRT-, MEM-, NTF-, INV- are internal and never shown as an organisation/lot code.

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

/** Trailing running number of any code ("LOT-2610-0042" → 42). */
export function codeNumber(code?: string | null): number {
  const m = /(\d+)$/.exec(code ?? "");
  return m ? parseInt(m[1], 10) : 0;
}

export const formatCid = (n: number) => `CID-${pad(n)}`;
export const formatPkg = (n: number) => `PKG-${pad(n)}`;

/** YYMM in Asia/Bangkok, Gregorian (LOT-2610-… = October 2026). */
export function lotYm(d: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")!.value}${p.find((x) => x.type === "month")!.value}`;
}
export const formatLot = (n: number, d: Date = new Date()) => `LOT-${lotYm(d)}-${pad(n)}`;

/** The organisation code to show for a farm (falls back to the old id before backfill). */
export const cidOf = (s: { id: string; code?: string | null }) => s.code || s.id;

export function nextUserId(existingCount: number): string {
  return `USR-${pad(existingCount + 1)}`;
}

export function nextPrintId(existingCount: number): string {
  return `PRT-${pad(existingCount + 1)}`;
}

export function nextMemberId(existingCount: number): string {
  return `MEM-${pad(existingCount + 1)}`;
}

export function nextNotificationId(existingCount: number): string {
  return `NTF-${String(existingCount + 1).padStart(4, "0")}`;
}

export function nextInviteId(existingCount: number): string {
  return `INV-${pad(existingCount + 1)}`;
}
