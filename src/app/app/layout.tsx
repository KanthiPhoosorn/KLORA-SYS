import { requireUser } from "@/lib/auth";
import { getSupplier } from "@/lib/store";
import ConsoleShell from "@/components/ConsoleShell";
import LogoutButton from "@/components/LogoutButton";
import type { NavItem } from "@/components/SidebarNav";

export const dynamic = "force-dynamic";

const ITEMS: NavItem[] = [
  { href: "/app", label: "ภาพรวม", icon: "home", exact: true },
  { href: "/app/new", label: "กรอกข้อมูลรอบส่งออก", icon: "plus" },
  { href: "/app/dashboard", label: "แดชบอร์ดคาร์บอน", icon: "leaf" },
  { href: "/app/history", label: "ประวัติการส่งออก", icon: "history" },
  { href: "/app/farm", label: "ข้อมูลฟาร์ม", icon: "settings" },
];

export default async function SupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supplier = await getSupplier(user.supplierId);

  const header = (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        SUP ID
      </div>
      <div className="mt-0.5 font-mono text-sm font-bold text-slate-900">
        {supplier?.id ?? user.supplierId}
      </div>
      {supplier ? (
        <div className="mt-0.5 truncate text-xs text-slate-500">{supplier.farmName}</div>
      ) : null}
    </div>
  );

  return (
    <ConsoleShell header={header} items={ITEMS} footer={<LogoutButton />}>
      {children}
    </ConsoleShell>
  );
}
