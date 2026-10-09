import { requireRole } from "@/lib/auth";
import { getCustomEntries, getSuppliers } from "@/lib/store";
import CustomReview from "@/components/CustomReview";

export const dynamic = "force-dynamic";

// รายการ "อื่นๆ" รอตรวจสอบ — Thai Post doc 9 Oct 2026: every dropdown has "อื่นๆ (ระบุ)" and KYN
// confirms the typed values (EF from TGO's carbon-label database when it feeds the calculation).
export default async function KynReviewPage() {
  await requireRole("kyn");
  const [entries, suppliers] = await Promise.all([getCustomEntries(), getSuppliers()]);
  const farmName = Object.fromEntries(suppliers.map((s) => [s.id, s.farmName]));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">รายการ “อื่นๆ” รอตรวจสอบ</h1>
        <p className="mt-1 text-[13px] text-slate-500">ค่าที่ผู้ใช้พิมพ์เองนอกรายการ — ตรวจความถูกต้อง แล้วยืนยันเพื่อเพิ่มเป็นรายการใหม่</p>
      </div>
      <CustomReview entries={entries} farmName={farmName} />
    </div>
  );
}
