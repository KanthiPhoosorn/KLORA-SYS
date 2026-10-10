// Satisfaction ratings (Thai Post doc §15) — shared bits for the QR page, the API and the back offices.
import type { RatingSummary } from "./types";

/** Anonymous per-device id: one rating per device per lot. */
export const RATER_COOKIE = "corta_rater";

/** "4.6" — one decimal, for display next to a ★. */
export const avgText = (s: RatingSummary) => (s.n ? s.avg.toFixed(1) : "–");
