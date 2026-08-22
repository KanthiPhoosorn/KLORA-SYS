import { requireRole } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import { Card } from "@/components/ui";
import { LifeBuoy, Mail, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">จัดการระบบ</h1>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-800">บัญชีผู้ใช้</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-400">ชื่อผู้ใช้</dt><dd className="text-slate-800">{user.username}</dd></div>
          <div><dt className="text-slate-400">อีเมล</dt><dd className="text-slate-800">{user.email}</dd></div>
          <div><dt className="text-slate-400">SUP ID</dt><dd className="font-mono text-slate-800">{supplier?.id}</dd></div>
          <div><dt className="text-slate-400">ฟาร์ม</dt><dd className="text-slate-800">{supplier?.farmName}</dd></div>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800"><LifeBuoy size={18} className="text-emerald-600" /> ติดต่อแอดมิน · ขอคำแนะนำ</h2>
        <div className="mt-3 space-y-2 text-sm">
          <a href="https://line.me/R/ti/p/@klora-support" className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50">
            <MessageCircle size={16} className="text-emerald-600" /> LINE Official: <b>@klora-support</b>
          </a>
          <a href="mailto:support@klora.app" className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50">
            <Mail size={16} className="text-blue-600" /> อีเมล: <b>support@klora.app</b>
          </a>
        </div>
      </Card>
    </div>
  );
}
