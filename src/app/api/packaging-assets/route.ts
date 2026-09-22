import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { listPackagingAssets, createPackagingAsset, getSupplier } from "@/lib/store";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import type { PackagingAsset } from "@/lib/types";

const KINDS: PackagingAsset["kind"][] = ["basket", "corrugated_box", "plastic_film"];
const pos = (x: unknown) => (x != null && x !== "" && Number(x) > 0 ? Number(x) : undefined);

// GET /api/packaging-assets — registered reusable packaging (with trip counts) for the picker.
export async function GET() {
  const g = await guard();
  if (g.deny) return g.deny;
  return NextResponse.json(await listPackagingAssets({ role: g.user.role, supplierId: g.user.supplierId }));
}

// POST /api/packaging-assets — "ลงทะเบียนใหม่": the system issues the code (BSK-2026-00001 …).
export async function POST(req: Request) {
  const g = await guard();
  if (g.deny) return g.deny;
  const lim = await rateLimit(`pkg-assets:user:${g.user.id}`, 60, 60 * 60 * 1000);
  if (!lim.allowed) return tooMany(lim.retryAfter);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const kind = String(body.kind) as PackagingAsset["kind"];
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "กรุณาเลือกบรรจุภัณฑ์" }, { status: 400 });
  const u = g.user;
  let ownerSupplierId: string | undefined;
  let ownerLabel: string;
  if (u.role === "supplier" && u.supplierId) {
    ownerSupplierId = u.supplierId;
    ownerLabel = (await getSupplier(u.supplierId))?.farmName ?? u.supplierId;
  } else if (u.role === "logistic") {
    ownerLabel = [u.company ?? u.username, u.branch].filter(Boolean).join(" · ");
  } else {
    ownerLabel = "KYN";
  }
  const asset = await createPackagingAsset({
    kind, width: pos(body.width), length: pos(body.length), height: pos(body.height),
    priorUses: Number(body.priorUses) || 0, ownerSupplierId, ownerLabel, createdBy: u.id,
  });
  return NextResponse.json(asset, { status: 201 });
}
