// "Sign in with Google" — plain OAuth 2.0 authorization-code flow, no SDK.
// Identity only: Google tells us a verified email, and we sign in the EXISTING KLORA
// account with that email (a farm needs its full profile, so accounts are never
// auto-created here). Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
//
// Redirect URI to register in Google Cloud → Credentials → OAuth client (Web):
//   <origin>/api/auth/google/callback   e.g. https://corta.tech/api/auth/google/callback

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const USERINFO_URL = process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";

export const STATE_COOKIE = "klora_oauth_state";

// Which login page a portal's Google button returns to on error.
export function loginPathFor(portal: string | null): string {
  if (portal === "kyn") return "/kyn/login";
  if (portal === "logistic") return "/logistic/login";
  return "/login";
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function callbackUrl(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${p}`;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name?: string;
}

// Exchange the auth code for tokens, then read the verified profile. Throws on any failure.
export async function exchangeCode(code: string, origin: string): Promise<GoogleIdentity> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const tok = (await tokenRes.json()) as { access_token?: string };
  if (!tok.access_token) throw new Error("no access_token");

  const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!infoRes.ok) throw new Error(`userinfo failed: ${infoRes.status}`);
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
  if (!info.email) throw new Error("no email in userinfo");
  return { email: info.email, emailVerified: info.email_verified === true, name: info.name };
}
