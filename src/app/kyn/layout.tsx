import Link from "next/link";
import ConsoleShell from "@/components/ConsoleShell";
import type { NavItem } from "@/components/SidebarNav";
import { Factory } from "lucide-react";

const ITEMS: NavItem[] = [
  { href: "/kyn", label: "ภาพรวม", icon: "home", exact: true },
  { href: "/kyn/incoming", label: "ข้อมูลที่รับเข้า", icon: "inbox" },
  { href: "/kyn/report", label: "รายงานสรุป", icon: "report" },
  { href: "/kyn/suppliers", label: "จัดการ SUP", icon: "users" },
  { href: "/kyn/qrlog", label: "Shipment / QR log", icon: "qr" },
];

export default function KynLayout({ children }: { children: React.ReactNode }) {
  const header = (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-500 text-white">
        <Factory size={17} />
      </span>
      <div>
        <div className="text-sm font-bold text-slate-900">KYN</div>
        <div className="text-xs text-slate-400">กลางน้ำ</div>
      </div>
    </Link>
  );

  return (
    <ConsoleShell header={header} items={ITEMS}>
      {children}
    </ConsoleShell>
  );
}
