import { notFound } from "next/navigation";
import Link from "next/link";
import { Flower2, LifeBuoy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSupplier, getNotifications } from "@/lib/store";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import AccountButton from "@/components/portal/AccountButton";
import NotificationBell from "@/components/NotificationBell";

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
  const notifs = await getNotifications(user.supplierId);

  // Freemium (Figma "Lock" state): ภาพรวม + แดชบอร์ดคาร์บอน are Pro-only; the rest stay free.
  const isPro = supplier.plan === "pro";
  const items = ITEMS.map((it) =>
    !isPro && (it.href === "/app" || it.href === "/app/dashboard") ? { ...it, locked: true } : it,
  );

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
        <NotificationBell notifs={notifs} />
        <AccountButton label="SUP ID" id={supplier.id} profileHref="/app/profile" />
      </div>
    </>
  );

  const footer = (
    <div className="flex max-h-[42vh] justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/farmer.webp" alt="" aria-hidden className="pointer-events-none w-full select-none object-contain object-bottom" />
    </div>
  );

  return (
    <PortalShell accent="pink" brand="Supplier" brandMark={brandMark} items={items} header={header} footer={footer}>
      {children}
    </PortalShell>
  );
}
