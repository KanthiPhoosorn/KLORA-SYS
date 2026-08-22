import type { ReactNode } from "react";

// Shared two-pane auth layout: hero illustration (desktop) + centered form.
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[63%] shrink-0 overflow-hidden bg-emerald-50 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/login-hero.png" alt="KLORA farm" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 items-center justify-center bg-white px-8 py-10">
        <div className="w-full max-w-[425px]">{children}</div>
      </div>
    </div>
  );
}
