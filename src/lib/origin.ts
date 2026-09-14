// Public origin of the CURRENT request (for OAuth redirect URIs and links in emails).
// The proxy-forwarded host (Vercel) wins so that cookies set during a flow and the
// redirect back land on the same host the visitor is on (www vs apex would otherwise
// break the OAuth state check). NEXT_PUBLIC_BASE_URL is only the fallback when no host
// header is present (e.g. background jobs).
export function siteOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || (/^(localhost|127\.0\.0\.1)/.test(host) ? "http" : "https");
    return `${proto}://${host}`;
  }
  const env = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return env || new URL(req.url).origin;
}
