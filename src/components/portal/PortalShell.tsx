"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  FileText,
  Building2,
  Users2,
  QrCode,
  Lock,
  SlidersHorizontal,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: LayoutGrid,
  plus: PlusCircle,
  chart: LineChart,
  history: History,
  file: FileText,
  building: Building2,
  farm: Store,
  settings: Settings,
  inbox: Inbox,
  search: Search,
  report: FileBarChart,
  users: Users2,
  qr: QrCode,
  sliders: SlidersHorizontal,
};

export type Accent = "pink" | "blue" | "slate" | "purple";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
  locked?: boolean;
}

const ACCENT: Record<Accent, { brand: string; active: string; dot: string }> = {
  pink: { brand: "text-[#018e46]", active: "bg-[#e1478a] text-white shadow-sm", dot: "text-slate-400" },
  blue: { brand: "text-blue-600", active: "bg-blue-600 text-white shadow-sm", dot: "text-slate-400" },
  slate: { brand: "text-slate-900", active: "bg-slate-800 text-white shadow-sm", dot: "text-slate-400" },
  purple: { brand: "text-brand-purple", active: "bg-brand-purple text-white shadow-sm", dot: "text-slate-400" },
};

export default function PortalShell({
  accent,
  brand,
  items,
  header,
  footer,
  account,
  children,
}: {
  accent: Accent;
  brand: string;
  items: PortalNavItem[];
  header: ReactNode;
  footer?: ReactNode;
  /** shown at the top of the phone drawer — the phone header has no room for the ID */
  account?: { label: string; id: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const a = ACCENT[accent];

  // Phones (< md) have no sidebar: the top bar shows the Corta logo and a ☰ button that opens the same
  // menu as a drawer (Thai Post doc 9 Oct 2026 §1 logo top-left on every system, §8 nothing crammed).
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // Corta wordmark — the same for every portal (role lives in the menu, not the brand)
  const logo = (className: string) => (
    <Link href={items[0]?.href ?? "/"} className={className} aria-label={`Corta ${brand}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/corta-logo.png" alt="Corta" className="h-7 w-auto" />
    </Link>
  );

  const nav = (
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
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active ? `${a.active} font-semibold` : "font-medium text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon size={18} className={active ? "" : a.dot} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        {logo("flex items-center px-6 py-5")}
        <div className="px-6 pb-1 text-xs font-medium text-slate-400">Menu</div>
        {nav}
        <div className="mt-auto">{footer}</div>
      </aside>

      {/* Phone menu drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setNavOpen(false)} aria-hidden />
          <aside role="dialog" aria-modal="true" aria-label="เมนู" className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              {logo("flex items-center")}
              <button type="button" onClick={() => setNavOpen(false)} aria-label="ปิดเมนู" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            {account ? (
              <div className="mx-5 mb-3 rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{account.label}</div>
                <div className="font-mono text-sm font-semibold text-slate-800">{account.id}</div>
              </div>
            ) : null}
            <div className="px-6 pb-1 text-xs font-medium text-slate-400">Menu</div>
            {nav}
          </aside>
        </div>
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:gap-4 md:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="เปิดเมนู"
            aria-expanded={navOpen}
            className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <Menu size={20} />
          </button>
          {logo("flex shrink-0 items-center md:hidden")}
          {header}
        </header>
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
