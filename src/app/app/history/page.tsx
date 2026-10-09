import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getBatchesBySupplier, getPrints } from "@/lib/store";
import ShipmentsTable from "@/components/ShipmentsTable";
import { toShipRows } from "@/lib/ship-rows";
import { CheckCircle2, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

// ประวัติการส่งออก — every round incl. cancelled ones (greyed); the same ✏️ manage menu as the overview.
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ edited?: string }> }) {
  const user = await requireRole("supplier");
  const { edited } = await searchParams;
  const [batches, prints] = await Promise.all([getBatchesBySupplier(user.supplierId!), getPrints()]);
  const rows = toShipRows(batches, prints);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ประวัติการส่งออก</h1>
      {edited ? (
        <p className="flex items-center gap-2 rounded-[12px] bg-emerald-50 px-4 py-3 text-[14px] font-medium text-emerald-700">
          <CheckCircle2 size={18} /> บันทึกการแก้ไข {edited} แล้ว · คำนวณคาร์บอนใหม่และเพิ่มในประวัติการแก้ไขเรียบร้อย
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand-pink-light text-brand-pink">
            <Inbox size={34} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">ยังไม่มีประวัติการส่งออก</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            เมื่อคุณบันทึกรอบการส่งออก ประวัติทั้งหมดจะปรากฏที่นี่ พร้อมให้กรอง จัดการ และติดตามสถานะ
          </p>
          <Link href="/app/new" className="mt-6 inline-flex rounded-[8px] bg-brand-pink px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
            + กรอกข้อมูลส่งออก
          </Link>
        </div>
      ) : (
        <ShipmentsTable rows={rows} filters highlight={edited} />
      )}
    </div>
  );
}
