import { qrSvg } from "@/lib/qr";

// GET /api/qr?data=<string> → inline SVG QR code.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const data = q.get("data");
  // ?m= quiet-zone modules (0–4); labels pass 0 and draw their own 2 mm white border
  const m = Math.min(4, Math.max(0, Number(q.get("m") ?? 1) || 0));
  if (!data) {
    return new Response("missing ?data=", { status: 400 });
  }
  const svg = await qrSvg(data, q.has("m") ? m : 1);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
