import { notFound } from "next/navigation";
import Link from "next/link";
import { Bell, Flower2, LifeBuoy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import AccountButton from "@/components/portal/AccountButton";

export const dynamic = "force-dynamic";

const ITEMS: PortalNavItem[] = [
  { href: "/app", label: "ภาพรวม", icon: "home", exact: true },
  { href: "/app/new", label: "เพิ่มข้อมูลรอบส่งออก", icon: "plus" },
  { href: "/app/dashboard", label: "แดชบอร์ดคาร์บอน", icon: "chart" },
  { href: "/app/history", label: "ประวัติการส่งออก", icon: "history" },
  { href: "/app/farm", label: "ข้อมูลฟาร์ม", icon: "farm" },
  { href: "/app/settings", label: "จัดการระบบ", icon: "settings" },
];

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("supplier");
  const supplier = user.supplierId ? await getSupplier(user.supplierId) : null;
  if (!supplier) notFound();

  const brandMark = (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
      <Flower2 size={17} />
    </span>
  );

  const header = (
    <>
      <div className="text-lg font-semibold text-slate-800">{supplier.farmName}</div>
      <div className="ml-auto flex items-center gap-4">
        <Link
          href="/app/settings"
          className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 sm:flex"
        >
          <LifeBuoy size={16} /> Help center
        </Link>
        <Link href="/app/notifications" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" title="แจ้งเตือน">
          <Bell size={18} />
        </Link>
        <AccountButton label="SUP ID" id={supplier.id} profileHref="/app/profile" />
      </div>
    </>
  );

  const footer = (
    <div className="m-3 overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50 to-emerald-100/70 p-4 text-center">
      <div className="text-4xl leading-none">🧑‍🌾</div>
      <div className="mt-2 text-xs font-medium text-emerald-700">KLORA · ต้นน้ำ</div>
      <div className="text-[11px] text-emerald-600/70">Supplier portal</div>
    </div>
  );

  return (
    <PortalShell accent="pink" brand="Supplier" brandMark={brandMark} items={ITEMS} header={header} footer={footer}>
      {children}
    </PortalShell>
  );
}
