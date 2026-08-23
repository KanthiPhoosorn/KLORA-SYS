import { requireRole } from "@/lib/auth";
import ScanQr from "@/components/ScanQr";

export const dynamic = "force-dynamic";

export default async function LogisticScanPage() {
  await requireRole("logistic");
  return <ScanQr />;
}
