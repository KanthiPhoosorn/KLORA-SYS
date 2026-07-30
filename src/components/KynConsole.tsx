"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Factory } from "lucide-react";
import TopBar from "./TopBar";
import HelpButton from "./HelpButton";

export interface KynSection {
  key: string;
  label: string;
  node: ReactNode;
}

// KYN as a single page: a top bar + in-page tabs (no sidebar). Only the active
// section is rendered; switching tabs never changes the route.
export default function KynConsole({ sections }: { sections: KynSection[] }) {
  const [active, setActive] = useState(sections[0]?.key);
  const current = sections.find((s) => s.key === active) ?? sections[0];

  const left = (
    <div className="flex items-center gap-4">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-500 text-white">
          <Factory size={17} />
        </span>
        <span className="text-sm font-bold text-slate-900">KYN</span>
      </Link>
      <nav className="hidden items-center gap-1 md:flex">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active === s.key
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen">
      <TopBar left={left} right={<HelpButton />} />
      {/* Mobile tab strip */}
      <div className="no-print border-b border-slate-200 bg-white md:hidden">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                active === s.key ? "bg-blue-50 text-blue-700" : "text-slate-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-6">{current?.node}</main>
    </div>
  );
}
