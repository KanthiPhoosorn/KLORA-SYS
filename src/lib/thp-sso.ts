// Thai Post SuperApp single sign-on for the Corta mini app (partner guide 21 Oct 2026). Server-only.
// The SuperApp hands the page a one-time handoff; we turn it into a challenge with the client secret,
// trade that for a short-lived SSO token, read the member's profile once and keep ONLY the name, in our own
// signed cookie (never the database). The secret, handoffs, challenges and tokens are never logged.

import { createHash, createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.KLORA_SESSION_SECRET || "klora-dev-secret-change-in-production";
export const MEMBER_COOKIE = "corta_member";
const MEMBER_MAX_AGE_S = 60 * 60 * 8; // 8 hours
const CALL_TIMEOUT_MS = 10_000;

const cfg = () => ({
  base: (process.env.THP_SSO_BASE_URL || "").replace(/\/+$/, ""),
  clientId: process.env.THP_SSO_CLIENT_ID || "",
  secret: process.env.THP_SSO_CLIENT_SECRET || "",
});

/** True when the three SSO settings exist. */
/** The API host and a short fingerprint of the three settings: lets two deployments be compared without showing
 *  any value (10 hex chars of a SHA-256 over all three reveal nothing usable). */
export function ssoFingerprint(): string {
  const c = cfg();
  let host = "";
  try { host = new URL(c.base).host; } catch { host = "invalid-url"; }
  return `${host} cfg ${createHash("sha256").update(`${c.base}|${c.clientId}|${c.secret}`).digest("hex").slice(0, 10)}`;
}

export function ssoOn(): boolean {
  const c = cfg();
  return !!(c.base && c.clientId && c.secret);
}

/** A handoff is 64 hex characters; it is used exactly as received. */
export function isHandoff(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-fA-F]{64}$/.test(v);
}

/** challenge = lowercase hex of HMAC-SHA-256(key = client secret, message = handoff), both UTF-8. */
export function computeChallenge(handoff: string, secret: string): string {
  return createHmac("sha256", secret).update(handoff, "utf8").digest("hex");
}

// --- errors ---------------------------------------------------------------

const MSG_BAD_LINK = "ลิงก์เข้าใช้งานไม่ถูกต้อง กรุณาเปิด Corta ใหม่จากแอปไปรษณีย์ไทย";
const MSG_EXPIRED = "ลิงก์หมดอายุแล้ว กรุณาเปิด Corta ใหม่จากแอปไปรษณีย์ไทย";
const MSG_NOT_ENABLED = "Corta ยังไม่เปิดให้ใช้งานในแอปไปรษณีย์ไทย";
const MSG_TERMS = "กรุณายอมรับเงื่อนไขการใช้งานในแอปไปรษณีย์ไทยก่อน แล้วเปิด Corta อีกครั้ง";
const MSG_NO_READ = "ไม่สามารถอ่านข้อมูลสมาชิกได้ กรุณาลองใหม่ภายหลัง";
const MSG_BUSY = "มีผู้ใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองใหม่";
const MSG_DOWN = "ระบบของไปรษณีย์ไทยขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";

export class SsoError extends Error {
  code: string;
  status: number;
  /** the gateway's own words when the answer is not in Thai Post's error format (never contains tokens) */
  detail?: string;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "SsoError";
    this.code = code;
    this.status = status;
  }
}

/** The error code of a Thai Post answer: { error: { code } } or the gateway's { error: "invalid_token" }. */
function codeOf(body: unknown): string {
  const e = (body as { error?: unknown } | null)?.error;
  if (e && typeof e === "object") {
    const c = (e as { code?: unknown }).code;
    return typeof c === "string" || typeof c === "number" ? String(c) : "";
  }
  return typeof e === "string" ? e : "";
}

/** Thai message by code first, then by HTTP status. `where` tells the profile call's 401 apart. */
function failure(code: string, status: number): SsoError {
  const err = (m: string) => new SsoError(code || String(status), status, m);
  switch (code) {
    case "004001": return err(MSG_BAD_LINK);
    case "500011": case "500012": return err(MSG_EXPIRED);
    case "500010": return err(MSG_NOT_ENABLED);
    case "500009": return err(MSG_TERMS);
    case "500014": return err(MSG_NO_READ);
    case "509999": case "005009": return err(MSG_DOWN);
  }
  if (status === 400) return err(MSG_BAD_LINK);
  if (status === 401) return err(MSG_EXPIRED);
  if (status === 403) return err(MSG_NO_READ);
  if (status === 429) return err(MSG_BUSY);
  return err(MSG_DOWN);
}

async function call(path: string, init: RequestInit): Promise<{ status: number; body: unknown; text: string }> {
  const c = cfg();
  try {
    const r = await fetch(`${c.base}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      headers: { Accept: "application/json", "Accept-Language": "th", ...(init.headers as Record<string, string> | undefined) },
    });
    const text = await r.text().catch(() => "");
    let body: unknown = null;
    try { body = JSON.parse(text); } catch { /* not JSON, e.g. a gateway page */ }
    return { status: r.status, body, text };
  } catch {
    // network error or timeout: nothing from the request or response is kept
    throw new SsoError("network", 502, MSG_DOWN);
  }
}

/** When an answer has no Thai Post error code (a gateway rule, a proxy page), keep its message so the cause can be
 *  seen: the body's "message" or the start of its text, with anything token-like removed. */
function withDetail(err: SsoError, res: { body: unknown; text: string }): SsoError {
  if (codeOf(res.body)) return err;
  const m = (res.body as { message?: unknown } | null)?.message;
  const raw = typeof m === "string" ? m : res.text.replace(/<[^>]*>/g, " ");
  err.detail = raw.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, "[jwt]").replace(/[0-9a-fA-F]{32,}/g, "[hex]").replace(/\s+/g, " ").trim().slice(0, 200);
  return err;
}

/** Handoff → SSO token → profile. Returns only the name (possibly absent). Throws SsoError. */
export async function redeemHandoff(handoff: string): Promise<{ name?: string }> {
  const c = cfg();
  if (!ssoOn()) throw new SsoError("500010", 503, MSG_NOT_ENABLED);
  if (!isHandoff(handoff)) throw new SsoError("004001", 400, MSG_BAD_LINK);

  const tok = await call("/v1/sso/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: c.clientId, challenge: computeChallenge(handoff, c.secret) }),
  });
  const token = (tok.body as { data?: { token?: unknown } } | null)?.data?.token;
  if (tok.status !== 200 || typeof token !== "string" || !token) {
    throw withDetail(failure(tok.status === 200 ? "" : codeOf(tok.body), tok.status === 200 ? 502 : tok.status), tok);
  }

  const prof = await call("/v1/sso/profile", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  if (prof.status === 404 && codeOf(prof.body) === "004004") return {}; // no Post Family data: sign in without a name
  if (prof.status !== 200) throw withDetail(failure(codeOf(prof.body), prof.status), prof);
  const raw = (prof.body as { data?: { name?: unknown } } | null)?.data?.name;
  const name = typeof raw === "string" ? raw.trim().slice(0, 80) : "";
  return name ? { name } : {};
}

// --- the member cookie ----------------------------------------------------
// Separate from the portal login: its own name and its own HMAC prefix, so it can never pass as klora_session.

const sign = (payload: string) => createHmac("sha256", SECRET).update("corta-member:" + payload).digest("base64url");

/** The cookie as { name, value, options } for a NextResponse. Holds the name only. */
export function memberCookie(name?: string) {
  const payload = JSON.stringify({ v: 1, n: (name ?? "").slice(0, 80), exp: Date.now() + MEMBER_MAX_AGE_S * 1000 });
  return {
    name: MEMBER_COOKIE,
    value: `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: MEMBER_MAX_AGE_S,
      secure: process.env.NODE_ENV === "production",
    },
  };
}

/** The member behind a cookie value, or null when missing, forged or expired. name is "" when none was shared. */
export function readMember(cookieValue: string | undefined | null): { name: string } | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = Buffer.from(cookieValue.slice(0, dot), "base64url").toString();
  const sig = cookieValue.slice(dot + 1);
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(payload) as { v?: number; n?: unknown; exp?: unknown };
    if (p.v !== 1 || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return { name: typeof p.n === "string" ? p.n : "" };
  } catch {
    return null;
  }
}
