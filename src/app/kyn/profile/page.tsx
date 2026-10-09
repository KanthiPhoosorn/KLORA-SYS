import { requireRole } from "@/lib/auth";
import ProfileCard from "@/components/ProfileCard";
import DeleteAccountButton from "@/components/DeleteAccountButton";

export const dynamic = "force-dynamic";

// โปรไฟล์ผู้ใช้ — the same card in every portal (Thai Post doc 9 Oct 2026 §7).
export default async function ProfilePage() {
  const user = await requireRole("kyn");

  return (
    <div className="space-y-6">
      <ProfileCard accent="purple" initial={{ username: user.username, email: user.email, phone: user.phone ?? "", avatar: user.avatar ?? null }} />
      <div className="flex max-w-2xl items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="text-[14px] font-medium text-slate-800">ลบบัญชี</div>
          <div className="text-[13px] text-slate-400">ลบข้อมูลส่วนบุคคลของคุณออกจากระบบอย่างถาวร</div>
        </div>
        <DeleteAccountButton loginHref="/kyn/login" />
      </div>
    </div>
  );
}
