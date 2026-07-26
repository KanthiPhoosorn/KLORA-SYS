"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flower2, Sprout, Factory, Package, LayoutDashboard } from "lucide-react";

const LINKS = [
  { href: "/", label: "ภาพรวม", en: "Dashboard", icon: LayoutDashboard },
  { href: "/farm", label: "ต้นน้ำ · ฟาร์ม", en: "Farm", icon: Sprout },
  { href: "/kyn", label: "กลางน้ำ · KYN", en: "Processing", icon: Factory },
  { href: "/thaipost", label: "ปลายน้ำ · Thai Post", en: "Label", icon: Package },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-pink-900/10 bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-pink-200 to-pink-300 text-pink-600 ring-1 ring-pink-400/30">
            <Flower2 size={18} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-pink-400">
            KLORA
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-pink-100 text-pink-800"
                    : "text-pink-900/60 hover:bg-pink-50 hover:text-pink-800"
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{l.label}</span>
                <span className="sm:hidden">{l.en}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
