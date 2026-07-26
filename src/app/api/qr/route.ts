import { qrSvg } from "@/lib/qr";

// GET /api/qr?data=<string> → inline SVG QR code.
export async function GET(req: Request) {
  const data = new URL(req.url).searchParams.get("data");
  if (!data) {
    return new Response("missing ?data=", { status: 400 });
  }
  const svg = await qrSvg(data);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
