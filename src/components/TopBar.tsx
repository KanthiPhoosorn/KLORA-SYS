import Link from "next/link";
import type { ReactNode } from "react";

// Slim sticky top bar that replaces the old left sidebar. `left` is usually the brand
// (+ optional in-page tabs); `right` holds the actions for that role.
export default function TopBar({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {left ?? (
            <Link href="/" className="text-lg font-extrabold tracking-tight text-pink-500">
              KLORA
            </Link>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">{right}</div>
      </div>
    </header>
  );
}
