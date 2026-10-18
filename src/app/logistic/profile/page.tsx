import { Building2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { logisticAccess } from "@/lib/logistic-org";
import ProfileCard from "@/components/ProfileCard";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import CompanyNameEdit from "@/components/CompanyNameEdit";

export const dynamic = "force-dynamic";

// โปรไฟล์ผู้ใช้ — the same card in every portal (Thai Post doc 9 Oct 2026 §7). Below it the account's company
// and branch: ชื่อผู้ใช้ is this person's sign-in name, the company name is what the header shows, and only
// the head office renames it (doc "Logistic", 18 Oct 2026).
export default async function ProfilePage() {
  const user = await requireRole("logistic");
  const access = await logisticAccess(user);
  const company = access.org?.company ?? user.company;

  return (
    <div className="space-y-6">
      <ProfileCard accent="blue" initial={{ username: user.username, email: user.email, phone: user.phone ?? "", avatar: user.avatar ?? null }} />
      {company ? (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Building2 size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-slate-500">บริษัท</div>
              <div className="truncate text-[16px] font-semibold text-slate-900">{company}</div>
              <div className="mt-0.5 text-[13px] text-slate-500">{access.branch ? (access.branch.isHq ? "สำนักงานใหญ่" : access.branch.name) : user.branch ?? ""}</div>
              <div className="mt-2">
                {access.hq && access.org && access.state === "active"
                  ? <CompanyNameEdit company={access.org.company} />
                  : <span className="text-[12px] text-slate-400">ชื่อบริษัทแก้ไขได้โดยสำนักงานใหญ่</span>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex max-w-2xl items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="text-[14px] font-medium text-slate-800">ลบบัญชี</div>
          <div className="text-[13px] text-slate-400">ลบข้อมูลส่วนบุคคลของคุณออกจากระบบอย่างถาวร</div>
        </div>
        <DeleteAccountButton loginHref="/logistic/login" />
      </div>
    </div>
  );
}
