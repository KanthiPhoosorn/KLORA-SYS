import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui";
import ChangePasswordForm from "@/components/ChangePasswordForm";
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
        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-400">บทบาท</dt><dd className="text-slate-800">ผู้ดูแลระบบ KYN</dd></div>
          <div><dt className="text-slate-400">อีเมล</dt><dd className="text-slate-800">{user.email}</dd></div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
