// Photos taken while packing a round (12 Oct 2026) — shared by the form, the API, the QR page and KYN.

export interface PackPhoto {
  id: string;
  url: string; // /api/pack-photos/<id>
  takenAt?: string; // when the camera took it (EXIF, else the file's time) — ISO
  takenSrc: "exif" | "file" | "none";
  uploadedAt: string; // server time — the one that cannot be changed
  verified: boolean; // taken within VERIFY_HOURS of the upload
}

export const MAX_PACK_PHOTOS = 3;
export const VERIFY_HOURS = 24;

/** Verified = the photo carries a capture time, it is not in the future, and it was taken at most
 *  VERIFY_HOURS before it reached the server (an old gallery photo or a screenshot fails). */
export function isVerified(takenAt: string | null | undefined, uploadedAt: string): boolean {
  if (!takenAt) return false;
  const gap = new Date(uploadedAt).getTime() - new Date(takenAt).getTime();
  return Number.isFinite(gap) && gap >= -10 * 60_000 && gap <= VERIFY_HOURS * 3600_000;
}

/** "10 ต.ค. 69 · 08:30 น." in Bangkok time */
export function packTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
  return `${date} · ${time} น.`;
}

/** The packing time shown to buyers: the capture time when verified, else when it was saved. */
export const shownTime = (p: Pick<PackPhoto, "takenAt" | "uploadedAt" | "verified">) => (p.verified && p.takenAt ? p.takenAt : p.uploadedAt);
