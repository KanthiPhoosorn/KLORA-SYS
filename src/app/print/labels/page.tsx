import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getBatch, getSupplier } from "@/lib/store";
import { quantityLabel, categoryOf } from "@/lib/produce";
import { asLabelSize } from "@/lib/labels";
import LabelSheet, { type LabelData } from "@/components/LabelSheet";

export const dynamic = "force-dynamic";
export const metadata = { title: "พิมพ์ฉลาก QR · Corta" };

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** "2026-07-26" → "26 ก.ค. 69" (Buddhist-era year, 2 digits) */
function shortThai(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${TH_MONTH[Number(m[2]) - 1]} ${String((Number(m[1]) + 543) % 100).padStart(2, "0")}` : iso;
}

// Stand-alone label sheet (no portal shell) — opened in a new tab by the logistic search screen and
// prints itself once every QR has loaded. ?ids=LOT-…,LOT-… (old BAT- ids still resolve).
export default async function PrintLabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "logistic" && user.role !== "kyn")) redirect("/logistic/login");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "corta.tech";
  const origin = `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const ids = ((await searchParams).ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const labels: LabelData[] = [];
  for (const id of ids) {
    const b = await getBatch(id);
    const s = b ? await getSupplier(b.supplierId) : null;
    if (!b || !s) continue;
    const flower = categoryOf(b) === "flower";
    const type = b.productType || s.flowerType || "";
    const product = flower ? b.variety || type : [type, b.variety && b.variety !== type ? b.variety : ""].join("");
    labels.push({
      id: b.id,
      product: product || type,
      qty: quantityLabel(b),
      cut: `${flower ? "ตัด" : "เก็บ"} ${shortThai(b.cutDate)}`,
      farm: s.farmName,
      place: s.province ?? "",
      // short link → fewer QR modules → bigger dots on small stickers; no margin (the label adds 2 mm white)
      qr: `/api/qr?m=0&data=${encodeURIComponent(`${origin}/t/${b.id}`)}`,
    });
  }
  return <LabelSheet labels={labels} initialSize={asLabelSize(user.labelSize)} />;
}
