import Link from "next/link";
import { Bell, LifeBuoy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { logisticAccess } from "@/lib/logistic-org";
import { RECORDS_EXPORTS } from "@/lib/carriers";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import AccountButton from "@/components/portal/AccountButton";

export const dynamic = "force-dynamic";

export default async function LogisticLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("logistic");
  const access = await logisticAccess(user); // pending accounts never get here — requireRole sends them to /logistic/waiting

  const exports = !access.org || RECORDS_EXPORTS.includes(access.org.providerType);
  const items: PortalNavItem[] = [
    { href: "/logistic", label: "ภาพรวม", icon: "home", exact: true },
    ...(exports ? [{ href: "/logistic/new", label: "เพิ่มข้อมูลรอบส่งออก", icon: "plus" } as PortalNavItem] : []),
    { href: "/logistic/incoming", label: "รายการรับเข้าจากผู้ผลิต", icon: "inbox" },
    { href: "/logistic/search", label: "ค้นหา QR code", icon: "search" },
    // the per-branch comparison belongs to the head office; a branch sees only itself
    ...(access.hq ? [{ href: "/logistic/branches", label: "ข้อมูลรายสาขา", icon: "building" } as PortalNavItem] : []),
    { href: "/logistic/history", label: "ประวัติ", icon: "file" },
    { href: "/logistic/settings", label: "จัดการระบบ", icon: "users" },
  ];
  // Header: the company on top, "สำนักงานใหญ่" or the branch below — like the farm's name on the farm side
  // (doc "Logistic", 18 Oct 2026; it used to say "โรงคัดแยกพัสดุ" for every company)
  const company = access.org?.company ?? user.company ?? user.username;
  const where = access.branch ? (access.branch.isHq ? "สำนักงานใหญ่" : access.branch.name) : user.branch ?? "";

  const header = (
    <>
      <div className="hidden min-w-0 sm:block">
        <div className="truncate text-lg font-semibold text-slate-800">{company}</div>
        {where ? <div className="truncate text-[12px] text-slate-500">{where}</div> : null}
      </div>
      <div className="ml-auto flex items-center gap-4">
        <Link href="/logistic/settings" className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 sm:flex">
          <LifeBuoy size={16} /> Help center
        </Link>
        <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Bell size={18} /></button>
        <AccountButton label="ID" id={user.orgCode ?? user.username} profileHref="/logistic/profile" avatar={user.avatar} />
      </div>
    </>
  );

  return (
    <PortalShell accent="blue" items={items} header={header} account={{ label: "ID", id: user.orgCode ?? user.username }}>
      {children}
    </PortalShell>
  );
}
