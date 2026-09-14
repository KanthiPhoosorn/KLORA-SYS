// Public origin of this deployment (for OAuth redirect URIs and links in emails).
// NEXT_PUBLIC_BASE_URL wins; otherwise the proxy-forwarded host (Vercel) or the request URL.
export function siteOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
