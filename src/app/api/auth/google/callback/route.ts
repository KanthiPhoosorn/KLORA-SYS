import { NextResponse } from "next/server";
import { exchangeCode, googleConfigured, loginPathFor, STATE_COOKIE } from "@/lib/google-oauth";
import { siteOrigin } from "@/lib/origin";
import { getUserByLogin, getSupplier } from "@/lib/store";
import { homeForRole, sessionCookie } from "@/lib/auth";

// GET /api/auth/google/callback?code=&state= — finish Google sign-in.
// Only an EXISTING KLORA account with the same (verified) email can sign in this way;
// unknown emails are sent to register first. Every failure lands back on the login
// page with ?error=<code> (rendered in Thai by LoginForm).
export async function GET(req: Request) {
  const origin = siteOrigin(req);
  const url = new URL(req.url);
  const cookieHeader = req.headers.get("cookie") ?? "";
  const stateCookie = decodeURIComponent(/(?:^|;\s*)klora_oauth_state=([^;]+)/.exec(cookieHeader)?.[1] ?? "");
  const portal = stateCookie.split(".")[1] || null;
  const back = `${origin}${loginPathFor(portal)}`;
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${back}?error=${code}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  if (!googleConfigured()) return fail("google_unconfigured");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code) return fail("google_failed");
  if (!state || !stateCookie || state !== stateCookie) return fail("google_state");

  let identity;
  try {
    identity = await exchangeCode(code, origin);
  } catch (e) {
    console.error("[KLORA] Google sign-in failed", e);
    return fail("google_failed");
  }
  if (!identity.emailVerified) return fail("google_unverified");

  const user = await getUserByLogin(identity.email);
  if (!user) return fail("no_account");
  if (user.role === "supplier" && user.supplierId) {
    const sup = await getSupplier(user.supplierId);
    if (sup?.status === "suspended") return fail("suspended");
  }

  const res = NextResponse.redirect(`${origin}${homeForRole(user.role)}`);
  const sc = sessionCookie(user.id);
  res.cookies.set(sc.name, sc.value, sc.options);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
