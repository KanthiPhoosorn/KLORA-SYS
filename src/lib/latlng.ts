// The recipient pin (พิกัดปลายทาง) as typed or pasted — shared by the round forms and /api/geocode.

/** "13.7367, 100.5602", "13.7367 100.5602", or a Google Maps link that carries the point
 *  (…!3d13.73!4d100.56, /@13.73,100.56,17z, /place/13.73,100.56, /search/13.73,+100.56, ?q=13.73,100.56) → a point. */
export function parseLatLng(v: string): { lat: number; lng: number } | null {
  const s = v.trim();
  const n = "(-?\\d+(?:\\.\\d+)?)";
  const m = new RegExp(`!3d${n}!4d${n}`).exec(s) // the pin itself (a place link)
    ?? new RegExp(`/(?:place|search)/${n}(?:,|%2C)\\s*\\+?${n}`, "i").exec(s)
    ?? new RegExp(`[?&](?:q|ll|query|destination)=(?:loc:)?${n}(?:,|%2C)(?:\\s|\\+|%20)*${n}`, "i").exec(s)
    ?? new RegExp(`@${n},\\s*${n}`).exec(s) // the map's centre
    ?? new RegExp(`^${n}\\s*[,\\s]\\s*${n}$`).exec(s);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** A Google Maps share link that hides the point behind a redirect (maps.app.goo.gl/…, goo.gl/maps/…). */
export const isShortMapsLink = (v: string) => /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(v.trim());
