import { requireRole } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import { Card } from "@/components/ui";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { User } from "lucide-react";

export const dynamic = "force-dynamic";

const fieldCls = "w-full rounded-[8px] border border-gray-300 bg-slate-50 px-[14px] py-[10px] text-[13px] text-slate-700";

export default async function ProfilePage() {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</label>
      <div className={fieldCls}>{value || "—"}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">โปรไฟล์ผู้ใช้</h1>

      <Card className="p-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <span className="grid size-20 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400"><User size={40} /></span>
          <div className="rounded-xl border border-dashed border-gray-300 px-5 py-4">
            <div className="text-[13px] font-medium text-slate-700">อัปโหลดรูปโปรไฟล์</div>
            <div className="text-[12px] text-slate-400">JPG or PNG, 1MB Max</div>
          </div>
        </div>

        {/* Info fields */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อผู้ใช้" value={user.username} />
          <Field label="เบอร์โทร" value={supplier?.phone ?? "—"} />
          <div className="sm:col-span-2"><Field label="Email" value={user.email} /></div>
        </div>

        {/* Password row */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          <div>
            <div className="text-[14px] font-medium text-slate-800">รหัสผ่าน</div>
            <div className="text-[13px] text-slate-400">เปลี่ยนรหัสผ่านสำหรับการเข้าสู่ระบบ</div>
          </div>
          <ChangePasswordModal />
        </div>
      </Card>
    </div>
  );
}
