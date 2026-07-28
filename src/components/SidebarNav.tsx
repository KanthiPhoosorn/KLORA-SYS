"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Leaf,
  History,
  Settings,
  Inbox,
  BarChart3,
  Users2,
  QrCode,
  Search,
  Truck,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  plus: PlusCircle,
  leaf: Leaf,
  history: History,
  settings: Settings,
  inbox: Inbox,
  report: BarChart3,
  users: Users2,
  qr: QrCode,
  search: Search,
  truck: Truck,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS | string;
  exact?: boolean;
}

export default function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon size={17} className={active ? "text-blue-600" : "text-slate-400"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
