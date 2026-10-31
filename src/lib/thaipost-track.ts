// Thai Post Track & Trace API (THP asked us to register on track.thailandpost.co.th and try it, 30 Oct 2026).
// Server only. Off until THAIPOST_TRACK_TOKEN is set: the API token from the dashboard on that site.
//
// Two calls, as community clients use them (the official guide did not render for us; confirm against a real
// response with scripts/thaipost-track-probe.ts before showing anything to users):
//   POST /post/api/v1/authenticate/token   Authorization: Token <dashboard token> → { expire, token }
//   POST /post/api/v1/track                Authorization: Token <access token>
//        { status: "all", language: "TH", barcode: ["EF123456789TH", …] } → { response: { items, track_count } }
// Quota: about 1,000 tracked items a day per account (THP, 30 Oct 2026). Callers must cache results and never
// call this from public page views; only Thai Post numbers (XX123456789TH) are sent.

const BASE = process.env.THAIPOST_TRACK_BASE || "https://trackapi.thailandpost.co.th/post/api/v1";
const PER_CALL = 100; // tracking numbers sent in one /track call

export const thaipostTrackOn = () => !!process.env.THAIPOST_TRACK_TOKEN;
/** A Thai Post tracking number: two letters, nine digits, "TH" (EMS / registered mail / parcels). */
export const isThaipostBarcode = (v?: string | null) => /^[A-Z]{2}\d{9}TH$/.test((v ?? "").trim().toUpperCase());

/** One scan event as the API returns it; field names kept as sent so nothing is lost before they are confirmed. */
export interface TrackEvent {
  barcode: string;
  status: string; // code, e.g. "103"
  status_description?: string; // Thai Post's own label for the code
  status_date?: string; // "dd/mm/yyyy hh:mm:ss+07:00" (Buddhist year) in community examples
  location?: string;
  postcode?: string;
  delivery_status?: string | null;
  delivery_description?: string | null;
  delivery_datetime?: string | null;
  receiver_name?: string | null;
  [k: string]: unknown;
}
export interface TrackResult {
  items: Record<string, TrackEvent[]>;
  /** the account's usage today, if the API reports it */
  count?: { date?: string; used?: number; limit?: number };
  raw: unknown;
}

let access: { token: string; until: number } | null = null; // per server instance; the API token lasts weeks

async function accessToken(): Promise<string> {
  if (access && access.until > Date.now() + 60_000) return access.token;
  const key = process.env.THAIPOST_TRACK_TOKEN;
  if (!key) throw new Error("THAIPOST_TRACK_TOKEN is not set");
  const r = await fetch(`${BASE}/authenticate/token`, { method: "POST", headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" }, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { token?: string; expire?: string };
  if (!r.ok || !j.token) throw new Error(`Thai Post token request failed (${r.status})`);
  const until = j.expire ? Date.parse(j.expire.replace(" ", "T")) : NaN;
  access = { token: j.token, until: Number.isFinite(until) ? until : Date.now() + 6 * 3600_000 };
  return access.token;
}

/** Track Thai Post numbers (others are skipped), at most PER_CALL per request. */
export async function trackBarcodes(barcodes: string[], language: "TH" | "EN" = "TH"): Promise<TrackResult> {
  const list = [...new Set(barcodes.map((b) => b.trim().toUpperCase()).filter(isThaipostBarcode))];
  const out: TrackResult = { items: {}, raw: [] };
  for (let i = 0; i < list.length; i += PER_CALL) {
    const token = await accessToken();
    const r = await fetch(`${BASE}/track`, {
      method: "POST",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "all", language, barcode: list.slice(i, i + PER_CALL) }),
      cache: "no-store",
    });
    const j = (await r.json().catch(() => ({}))) as { response?: { items?: Record<string, TrackEvent[]>; track_count?: { track_date?: string; count_number?: number; track_count_limit?: number } } };
    if (r.status === 401) access = null; // token expired early: the next call fetches a new one
    if (!r.ok) throw new Error(`Thai Post track request failed (${r.status})`);
    Object.assign(out.items, j.response?.items ?? {});
    const c = j.response?.track_count;
    if (c) out.count = { date: c.track_date, used: c.count_number, limit: c.track_count_limit };
    (out.raw as unknown[]).push(j);
  }
  return out;
}
