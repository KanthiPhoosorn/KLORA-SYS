"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  LayoutGrid,
  PlusCircle,
  LineChart,
  History,
  Store,
  Settings,
  Inbox,
  Search,
  FileBarChart,
  Users2,
  QrCode,
  Lock,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: LayoutGrid,
  plus: PlusCircle,
  chart: LineChart,
  history: History,
  farm: Store,
  settings: Settings,
  inbox: Inbox,
  search: Search,
  report: FileBarChart,
  users: Users2,
  qr: QrCode,
};

export type Accent = "pink" | "blue" | "slate";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
  locked?: boolean;
}

const ACCENT: Record<Accent, { brand: string; active: string; dot: string }> = {
  pink: { brand: "text-emerald-700", active: "bg-pink-500 text-white shadow-sm", dot: "text-pink-600" },
  blue: { brand: "text-blue-600", active: "bg-blue-600 text-white shadow-sm", dot: "text-blue-600" },
  slate: { brand: "text-slate-900", active: "bg-slate-800 text-white shadow-sm", dot: "text-slate-700" },
};

export default function PortalShell({
  accent,
  brand,
  brandMark,
  items,
  header,
  footer,
  children,
}: {
  accent: Accent;
  brand: string;
  brandMark?: ReactNode;
  items: PortalNavItem[];
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const a = ACCENT[accent];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          {brandMark}
          <span className={`text-xl font-extrabold tracking-tight ${a.brand}`}>{brand}</span>
        </div>
        <div className="px-6 pb-1 text-xs font-medium text-slate-400">Menu</div>
        <nav className="flex flex-col gap-1 px-3 py-2">
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = ICONS[item.icon] ?? LayoutGrid;
            if (item.locked) {
              return (
                <span
                  key={item.href}
                  className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300"
                >
                  <Lock size={18} /> {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? a.active : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} className={active ? "" : a.dot} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">{footer}</div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
          {header}
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
