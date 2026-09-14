import { requireRole } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import { Card } from "@/components/ui";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import ProfileEditForm from "@/components/ProfileEditForm";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import { User } from "lucide-react";

export const dynamic = "force-dynamic";


export default async function ProfilePage() {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;


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

        {/* Info fields — editable (the email is also the Google sign-in match key) */}
        <div className="mt-6">
          <ProfileEditForm initial={{ username: user.username, email: user.email, phone: user.phone ?? supplier?.phone }} accent="pink" />
        </div>

        {/* Password row */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          <div>
            <div className="text-[14px] font-medium text-slate-800">รหัสผ่าน</div>
            <div className="text-[13px] text-slate-400">เปลี่ยนรหัสผ่านสำหรับการเข้าสู่ระบบ</div>
          </div>
          <ChangePasswordModal />
        </div>

        {/* Danger zone */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          <div>
            <div className="text-[14px] font-medium text-slate-800">ลบบัญชี</div>
            <div className="text-[13px] text-slate-400">ลบข้อมูลส่วนบุคคลของคุณออกจากระบบอย่างถาวร</div>
          </div>
          <DeleteAccountButton isFarmOwner />
        </div>
      </Card>
    </div>
  );
}
