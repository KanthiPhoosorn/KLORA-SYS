import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import ProfileEditForm from "@/components/ProfileEditForm";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import { User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KynProfilePage() {
  const user = await requireRole("kyn");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">โปรไฟล์ผู้ใช้</h1>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-500"><User size={30} /></span>
          <div>
            <div className="text-lg font-semibold text-slate-900">{user.username}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
            <div className="mt-1 inline-block rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white">KYN · {user.id}</div>
          </div>
        </div>
        <div className="mt-6">
          <ProfileEditForm initial={{ username: user.username, email: user.email, phone: user.phone }} accent="purple" />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</h2>
        <ChangePasswordForm />
      </Card>

      <Card className="flex items-center justify-between p-6">
        <div>
          <div className="text-[14px] font-medium text-slate-800">ลบบัญชี</div>
          <div className="text-[13px] text-slate-400">ลบข้อมูลส่วนบุคคลของคุณออกจากระบบอย่างถาวร</div>
        </div>
        <DeleteAccountButton loginHref="/kyn/login" />
      </Card>
    </div>
  );
}
