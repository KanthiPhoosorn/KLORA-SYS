import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMembers } from "@/lib/store";

function orgOf(u: { supplierId?: string; id: string }) {
  return u.supplierId ?? u.id;
}

// GET /api/members — members of the current user's organisation.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const members = await getMembers(orgOf(user));
  return NextResponse.json(members);
}
