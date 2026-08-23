import Link from "next/link";
import { Bell, Boxes, LifeBuoy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import AccountButton from "@/components/portal/AccountButton";

export const dynamic = "force-dynamic";

const ITEMS: PortalNavItem[] = [
  { href: "/logistic", label: "ภาพรวม", icon: "home", exact: true },
  { href: "/logistic/search", label: "ค้นหา / พิมพ์ QR", icon: "search" },
  { href: "/logistic/scan", label: "สแกน QR Code", icon: "qr" },
  { href: "/logistic/status", label: "สถานะพัสดุ", icon: "inbox" },
  { href: "/logistic/history", label: "ประวัติการพิมพ์", icon: "history" },
  { href: "/logistic/settings", label: "จัดการระบบ", icon: "settings" },
];

export default async function LogisticLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("logistic");

  const brandMark = (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 text-white">
      <Boxes size={17} />
    </span>
  );

  const header = (
    <>
      <div className="text-lg font-semibold text-slate-800">โรงคัดแยกพัสดุ</div>
      <div className="ml-auto flex items-center gap-4">
        <Link href="/logistic/settings" className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 sm:flex">
          <LifeBuoy size={16} /> Help center
        </Link>
        <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Bell size={18} /></button>
        <AccountButton label="Username" id={user.username} />
      </div>
    </>
  );

  const footer = (
    <div className="m-3 overflow-hidden rounded-2xl bg-gradient-to-b from-blue-50 to-blue-100/70 p-4 text-center">
      <div className="text-4xl leading-none">🚚</div>
      <div className="mt-2 text-xs font-medium text-blue-700">KLORA · ปลายน้ำ</div>
      <div className="text-[11px] text-blue-600/70">Logistic portal</div>
    </div>
  );

  return (
    <PortalShell accent="blue" brand="Logistic" brandMark={brandMark} items={ITEMS} header={header} footer={footer}>
      {children}
    </PortalShell>
  );
}
