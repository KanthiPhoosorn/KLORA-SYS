import type { ReactNode } from "react";
import SidebarNav, { type NavItem } from "./SidebarNav";

// The shared three-column-ish workspace layout: a left sidebar card (header + nav +
// optional footer) and a main content area. Used by the SUP, KYN and Thai Post shells.
export default function ConsoleShell({
  header,
  items,
  footer,
  children,
}: {
  header: ReactNode;
  items: NavItem[];
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid items-start gap-6 md:grid-cols-[248px_1fr]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {header ? (
            <div className="border-b border-slate-100 px-4 py-4">{header}</div>
          ) : null}
          <SidebarNav items={items} />
          {footer ? (
            <div className="border-t border-slate-100 p-2">{footer}</div>
          ) : null}
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
