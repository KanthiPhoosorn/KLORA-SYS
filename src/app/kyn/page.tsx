import { getSuppliers, getBatches, getPrints } from "@/lib/store";
import KynConsole, { type KynSection } from "@/components/KynConsole";
import KynOverviewSection from "@/components/KynOverviewSection";
import KynReportSection from "@/components/KynReportSection";
import KynQrLogSection from "@/components/KynQrLogSection";
import IncomingConsole from "@/components/IncomingConsole";
import SupManager from "@/components/SupManager";

export const dynamic = "force-dynamic";

export default async function KynPage() {
  const [suppliers, batches, prints] = await Promise.all([
    getSuppliers(),
    getBatches(),
    getPrints(),
  ]);

  const sections: KynSection[] = [
    { key: "overview", label: "ภาพรวม", node: <KynOverviewSection suppliers={suppliers} batches={batches} /> },
    { key: "incoming", label: "ข้อมูลที่รับเข้า", node: <IncomingConsole suppliers={suppliers} batches={batches} /> },
    { key: "report", label: "รายงานสรุป", node: <KynReportSection suppliers={suppliers} batches={batches} /> },
    { key: "suppliers", label: "จัดการ SUP", node: <SupManager suppliers={suppliers} /> },
    { key: "qrlog", label: "QR log", node: <KynQrLogSection prints={prints} /> },
  ];

  return <KynConsole sections={sections} />;
}
