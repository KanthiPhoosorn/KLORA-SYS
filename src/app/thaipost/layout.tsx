import Link from "next/link";
import ConsoleShell from "@/components/ConsoleShell";
import type { NavItem } from "@/components/SidebarNav";
import { Package } from "lucide-react";

const ITEMS: NavItem[] = [
  { href: "/thaipost", label: "ค้นหา/พิมพ์ QR", icon: "search", exact: true },
  { href: "/thaipost/history", label: "ประวัติการพิมพ์", icon: "history" },
  { href: "/thaipost/today", label: "สถานะพัสดุวันนี้", icon: "truck" },
];

export default function ThaiPostLayout({ children }: { children: React.ReactNode }) {
  const header = (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">
        <Package size={17} />
      </span>
      <div>
        <div className="text-sm font-bold text-slate-900">Thai Post</div>
        <div className="text-xs text-slate-400">ปลายน้ำ</div>
      </div>
    </Link>
  );

  return (
    <ConsoleShell header={header} items={ITEMS}>
      {children}
    </ConsoleShell>
  );
}
