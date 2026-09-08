import Link from "next/link";
import { Bell, LifeBuoy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import AccountButton from "@/components/portal/AccountButton";

export const dynamic = "force-dynamic";

const ITEMS: PortalNavItem[] = [
  { href: "/logistic", label: "ภาพรวม", icon: "home", exact: true },
  { href: "/logistic/new", label: "เพิ่มข้อมูลส่งออก", icon: "plus" },
  { href: "/logistic/search", label: "ค้นหา / พิมพ์ QR", icon: "search" },
  { href: "/logistic/scan", label: "สแกน QR Code", icon: "qr" },
  { href: "/logistic/status", label: "สถานะพัสดุ", icon: "inbox" },
  { href: "/logistic/history", label: "ประวัติการพิมพ์", icon: "history" },
  { href: "/logistic/settings", label: "จัดการระบบ", icon: "settings" },
];

export default async function LogisticLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("logistic");

  const brandMark = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/figma/logistic-logo.svg" alt="Logistic" className="h-8 w-auto" />
  );

  const header = (
    <>
      <div className="text-lg font-semibold text-slate-800">โรงคัดแยกพัสดุ</div>
      <div className="ml-auto flex items-center gap-4">
        <Link href="/logistic/settings" className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 sm:flex">
          <LifeBuoy size={16} /> Help center
        </Link>
        <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Bell size={18} /></button>
        <AccountButton label="Username" id={user.username} profileHref="/logistic/profile" />
      </div>
    </>
  );

  return (
    <PortalShell accent="blue" brand="" brandMark={brandMark} items={ITEMS} header={header}>
      {children}
    </PortalShell>
  );
}
