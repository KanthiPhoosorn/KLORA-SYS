import { requireRole } from "@/lib/auth";
import ScanQr from "@/components/ScanQr";

export const dynamic = "force-dynamic";

export default async function LogisticScanPage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  await requireRole("logistic");
  const { lot } = await searchParams;
  return <ScanQr initialLot={lot ?? ""} />;
}
