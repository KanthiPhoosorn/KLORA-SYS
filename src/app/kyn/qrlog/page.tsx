import { requireRole } from "@/lib/auth";
import { getPrints } from "@/lib/store";
import KynQrLogSection from "@/components/KynQrLogSection";

export const dynamic = "force-dynamic";

export default async function KynQrLogPage() {
  await requireRole("kyn");
  const prints = await getPrints();
  return <KynQrLogSection prints={prints} />;
}
