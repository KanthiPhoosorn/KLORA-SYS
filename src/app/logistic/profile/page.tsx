import { requireRole } from "@/lib/auth";
import LogisticProfileForm from "@/components/LogisticProfileForm";
import DeleteAccountButton from "@/components/DeleteAccountButton";

export const dynamic = "force-dynamic";

export default async function LogisticProfilePage() {
  const user = await requireRole("logistic");
  return (
    <div className="space-y-6">
      <LogisticProfileForm
        initial={{ username: user.username, email: user.email, phone: user.phone ?? "" }}
      />
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="text-[14px] font-medium text-slate-800">ลบบัญชี</div>
          <div className="text-[13px] text-slate-400">ลบข้อมูลส่วนบุคคลของคุณออกจากระบบอย่างถาวร</div>
        </div>
        <DeleteAccountButton />
      </div>
    </div>
  );
}
