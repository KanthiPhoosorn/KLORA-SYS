// Cheap evidence rules (9 Nov 2026): date checks, overdue lots, harvest photo vs the entered cut date.
// Pure, so the form, the API and the QA scripts share one copy.
import type { Batch } from "./types";
import { profileFor } from "./master-data";
import { categoryOf } from "./produce";
import { shownTime, type PackPhoto } from "./pack-photo";

const TZ = "Asia/Bangkok";
const DAY = 86_400_000;

export const todayBangkok = (now: Date = new Date()): string => now.toLocaleDateString("en-CA", { timeZone: TZ });
export const bangkokDate = (iso: string): string => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

const ymdMs = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const isRealDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(ymdMs(s)).toISOString().slice(0, 10) === s;

/** Whole days from `ymd` to today in Bangkok, never below 0. */
export function daysSinceBangkok(ymd: string, now: Date = new Date()): number {
  if (!isRealDate(ymd)) return 0;
  return Math.max(0, Math.round((ymdMs(todayBangkok(now)) - ymdMs(ymd)) / DAY));
}

export type RoundDateField = "cutDate" | "plantingDate" | "shipDate";
export function checkRoundDates(
  d: { cutDate?: string; plantingDate?: string; shipDate?: string },
  today: string = todayBangkok(),
): { field: RoundDateField; error: string } | null {
  const cut = d.cutDate ?? "";
  if (!isRealDate(cut)) return { field: "cutDate", error: "รูปแบบวันที่เก็บเกี่ยวไม่ถูกต้อง" };
  if (cut > today) return { field: "cutDate", error: "วันที่เก็บเกี่ยวต้องไม่เกินวันนี้" };
  if (d.plantingDate && d.plantingDate >= cut) return { field: "plantingDate", error: "วันที่ปลูกต้องอยู่ก่อนวันที่เก็บเกี่ยว" };
  if (d.shipDate && d.shipDate < cut) return { field: "shipDate", error: "วันที่จัดส่งต้องไม่ก่อนวันที่เก็บเกี่ยว" };
  return null;
}

/** Days after harvest before an unhandled lot is flagged: a quarter of the shelf life, 2 to 7 days.
 *  A starting value for KYN to tune. */
export const overdueLimitDays = (b: Pick<Batch, "productType" | "productCategory">): number =>
  Math.min(7, Math.max(2, Math.round(profileFor(b.productType, categoryOf(b)).shelfLifeDays * 0.25)));

export function isOverdue(
  b: Pick<Batch, "productType" | "productCategory" | "cutDate" | "status" | "cancelledAt" | "receivedAt">,
  o: { printed: boolean; now?: Date },
): boolean {
  if (b.cancelledAt || b.status === "draft" || o.printed || b.receivedAt) return false;
  return daysSinceBangkok(b.cutDate, o.now) >= overdueLimitDays(b);
}

/** When the earliest verified harvest photo was taken (or, without a capture time, saved); undefined when none. */
export function harvestPhotoAt(photos: Pick<PackPhoto, "takenAt" | "uploadedAt" | "verified" | "stage">[]): string | undefined {
  return photos.filter((p) => p.stage === "harvest" && p.verified).map((p) => shownTime(p)).sort()[0];
}

/** Only verified harvest photos count: "before" = taken before the entered cut date, "late" = the earliest
 *  one is 2 or more days after it. */
export function harvestPhotoFlag(cutDate: string, photos: Pick<PackPhoto, "takenAt" | "uploadedAt" | "verified">[]): "before" | "late" | null {
  const days = photos.filter((p) => p.verified).map((p) => bangkokDate(shownTime(p))).sort();
  if (!days.length || !isRealDate(cutDate)) return null;
  if (days[0] < cutDate) return "before";
  const lateFrom = new Date(ymdMs(cutDate) + 2 * DAY).toISOString().slice(0, 10);
  return days[0] >= lateFrom ? "late" : null;
}
