import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateUser } from "@/lib/store";
import { LABEL_SIZES } from "@/lib/labels";

const MAX_AVATAR = 120_000; // data-URL characters (~90 KB) — the client resizes to 256 px first

// PATCH /api/profile/prefs — small per-account preferences: the sticker size the carrier prints on
// (labelSize) and the profile picture (avatar: data:image/jpeg|png;base64,…, or null to remove).
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  let body: { labelSize?: string; avatar?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const patch: { labelSize?: string; avatar?: string | null } = {};
  if (body.labelSize !== undefined) {
    if (!LABEL_SIZES.some((x) => x.id === body.labelSize)) return NextResponse.json({ error: "ขนาดฉลากไม่ถูกต้อง" }, { status: 400 });
    patch.labelSize = String(body.labelSize);
  }
  if (body.avatar !== undefined) {
    if (body.avatar === null || body.avatar === "") patch.avatar = null;
    else {
      const a = String(body.avatar);
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a)) return NextResponse.json({ error: "รองรับเฉพาะรูป JPG หรือ PNG" }, { status: 400 });
      if (a.length > MAX_AVATAR) return NextResponse.json({ error: "รูปใหญ่เกินไป" }, { status: 413 });
      patch.avatar = a;
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
  await updateUser(user.id, patch as Parameters<typeof updateUser>[1]);
  return NextResponse.json({ ok: true, ...patch });
}
