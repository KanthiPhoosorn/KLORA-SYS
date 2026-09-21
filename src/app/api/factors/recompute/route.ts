import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getBatches, computeBatch } from "@/lib/store";

// POST /api/factors/recompute — KYN only: re-run the engine on every computed round so new
// factors apply to history. Shipment status is left untouched.
export async function POST() {
  const g = await guard(["kyn"]);
  if (g.deny) return g.deny;
  const targets = (await getBatches()).filter((b) => b.status === "computed");
  let ok = 0;
  for (const b of targets) {
    const r = await computeBatch(b.id, { advanceShipment: false }).catch(() => null);
    if (r?.status === "computed") ok++;
  }
  return NextResponse.json({ recomputed: ok, total: targets.length });
}
