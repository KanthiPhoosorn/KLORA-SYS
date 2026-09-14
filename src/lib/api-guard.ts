// Route-handler auth guard. Server-only.
//   const g = await guard(["logistic", "kyn"]); if (g.deny) return g.deny; const user = g.user;
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import type { User, UserRole } from "./types";

export const unauthorized = () => NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: "ไม่มีสิทธิ์ดำเนินการนี้" }, { status: 403 });

type Guarded = { user: User; deny?: undefined } | { user?: undefined; deny: NextResponse };

// Signed-in user (optionally restricted to roles) or a ready-made 401/403 response.
export async function guard(roles?: UserRole[]): Promise<Guarded> {
  const user = await getCurrentUser();
  if (!user) return { deny: unauthorized() };
  if (roles && !roles.includes(user.role)) return { deny: forbidden() };
  return { user };
}

// Organisation key for team features: a farm account's supplier, else the user itself.
export function orgOf(u: { supplierId?: string; id: string }): string {
  return u.supplierId ?? u.id;
}
