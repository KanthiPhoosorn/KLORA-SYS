import { getMedia } from "@/lib/store";

// GET /api/media/[id] — a farm / product photo for the public QR page. Ids are never reused (a new photo
// gets a new id), so the response can be cached for good.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = /^MD-[A-Z0-9]{8,20}$/.test(id) ? await getMedia(id) : null;
  if (!m) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(m.data, "base64"), {
    headers: { "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
