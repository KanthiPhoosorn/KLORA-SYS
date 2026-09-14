import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authorizeUrl, googleConfigured, loginPathFor, STATE_COOKIE } from "@/lib/google-oauth";
import { siteOrigin } from "@/lib/origin";

// GET /api/auth/google?portal=kyn — start "Sign in with Google". The CSRF `state`
// (random nonce + which login page to return to) lives in a short-lived httpOnly cookie.
export async function GET(req: Request) {
  const origin = siteOrigin(req);
  const portal = new URL(req.url).searchParams.get("portal");
  const back = `${origin}${loginPathFor(portal)}`;
  if (!googleConfigured()) return NextResponse.redirect(`${back}?error=google_unconfigured`);

  const state = `${randomBytes(16).toString("base64url")}.${portal ?? ""}`;
  const res = NextResponse.redirect(authorizeUrl(origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: origin.startsWith("https://"),
  });
  return res;
}
