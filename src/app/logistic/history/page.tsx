import { requireRole } from "@/lib/auth";
import { getPrints } from "@/lib/store";
import KynQrLogSection from "@/components/KynQrLogSection";

export const dynamic = "force-dynamic";

export default async function LogisticHistoryPage() {
  await requireRole("logistic");
  const prints = await getPrints();
  return <KynQrLogSection prints={prints} />;
}
