import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier, getPrints } from "@/lib/store";
import HistoryTable, { type HistoryRow } from "@/components/HistoryTable";
import ProLock from "@/components/ProLock";
import { thaiDateShort } from "@/lib/format";
import type { Tone } from "@/components/ui";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireRole("supplier");
  const [supplier, batches, prints] = await Promise.all([
    getSupplier(user.supplierId!),
    getBatchesBySupplier(user.supplierId!),
    getPrints(),
  ]);

  // Freemium: full export history is a Pro feature.
  if (supplier && supplier.plan !== "pro") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">ประวัติการส่งออก</h1>
        <ProLock
          title="ปลดล็อกประวัติการส่งออก"
          desc="อัปเกรดเป็นแพ็กเกจ Pro เพื่อดูประวัติการส่งออกย้อนหลังทั้งหมด กรองตามปลายทาง/สถานะ และติดตามการพิมพ์ QR ได้ครบทุกรอบ"
        />
      </div>
    );
  }

  const printed = new Set(prints.filter((p) => !p.cancelled).map((p) => p.batchId));

  const rows: HistoryRow[] = [...batches]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => {
      let statusLabel = "รอดำเนินการ";
      let statusTone: Tone = "neutral";
      if (printed.has(b.id)) { statusLabel = "พิมพ์ QR Code แล้ว"; statusTone = "green"; }
      else if (b.status === "computed") { statusLabel = "รอพิมพ์ QR Code"; statusTone = "amber"; }
      else if (b.status === "draft") { statusLabel = "ร่าง"; statusTone = "neutral"; }
      return {
        id: b.id,
        shipDate: thaiDateShort(b.entryDate),
        cutDate: thaiDateShort(b.cutDate),
        flowerCount: b.flowerCount,
        destination: b.destination ?? "",
        statusLabel,
        statusTone,
      };
    });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ประวัติการส่งออก</h1>
      {rows.length === 0 ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand-pink-light text-brand-pink">
            <Inbox size={34} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">ยังไม่มีประวัติการส่งออก</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            เมื่อคุณบันทึกรอบการส่งออกดอกไม้ ประวัติทั้งหมดจะปรากฏที่นี่ พร้อมให้กรองและติดตามสถานะ
          </p>
          <Link href="/app/new" className="mt-6 inline-flex rounded-[8px] bg-brand-pink px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
            + กรอกข้อมูลส่งออก
          </Link>
        </div>
      ) : (
        <HistoryTable rows={rows} />
      )}
    </div>
  );
}
