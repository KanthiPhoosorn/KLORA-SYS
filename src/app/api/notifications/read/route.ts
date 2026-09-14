import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { markNotificationsRead } from "@/lib/store";

// POST /api/notifications/read — mark every notification of the caller's farm as read.
export async function POST() {
  const g = await guard(["supplier"]);
  if (g.deny) return g.deny;
  if (g.user.supplierId) await markNotificationsRead(g.user.supplierId);
  return NextResponse.json({ ok: true });
}
