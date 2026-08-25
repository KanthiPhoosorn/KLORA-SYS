import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupplier, getFarmMonthlyInputs } from "@/lib/store";
import FarmSettingsForm from "@/components/FarmSettingsForm";
import FarmMonthlyForm from "@/components/FarmMonthlyForm";
import Co2eDisclosure from "@/components/Co2eDisclosure";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FarmInfoPage() {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;
  if (!supplier) notFound();

  const monthly = await getFarmMonthlyInputs(supplier.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ข้อมูลฟาร์ม</h1>
      <FarmSettingsForm supplier={supplier} />

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-800">บันทึกการใช้ทรัพยากรรายเดือน</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          กรอกยอดการใช้ทรัพยากรและผลผลิตของแต่ละเดือน ระบบจะคำนวณค่าคาร์บอนเฉพาะของฟาร์มคุณ
          (แทนการใช้ค่ากลาง) แล้วนำไปใช้กับรอบส่งออกโดยอัตโนมัติ
        </p>
        <div className="mt-5">
          <FarmMonthlyForm latest={monthly[0] ?? null} history={monthly} />
        </div>
        <Co2eDisclosure className="mt-4" />
      </Card>
    </div>
  );
}
