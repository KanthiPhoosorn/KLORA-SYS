import { requireRole } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import { Card } from "@/components/ui";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">โปรไฟล์ผู้ใช้</h1>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-pink-light text-brand-pink"><User size={30} /></span>
          <div>
            <div className="text-lg font-semibold text-slate-900">{user.username}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
            <div className="mt-1 inline-block rounded-full bg-brand-green-light px-2.5 py-0.5 text-xs font-medium text-brand-green-dark">Supplier · {supplier?.id}</div>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-400">ฟาร์ม</dt><dd className="text-slate-800">{supplier?.farmName}</dd></div>
          <div><dt className="text-slate-400">ผู้ติดต่อ</dt><dd className="text-slate-800">{supplier?.contactName ?? supplier?.owner}</dd></div>
          <div><dt className="text-slate-400">เบอร์โทร</dt><dd className="text-slate-800">{supplier?.phone ?? "—"}</dd></div>
          <div><dt className="text-slate-400">จังหวัด</dt><dd className="text-slate-800">{supplier?.province ?? "—"}</dd></div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
