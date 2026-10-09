import type { ReactNode } from "react";
import AuthLogo from "./AuthLogo";

// Shared two-pane auth layout: hero illustration (desktop) + centered form.
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen">
      <AuthLogo />
      <div className="relative hidden w-[63%] shrink-0 overflow-hidden bg-emerald-50 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/login-hero.png" alt="Corta farm" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 items-center justify-center bg-white px-8 pb-10 pt-20 lg:py-10">
        <div className="w-full max-w-[425px]">{children}</div>
      </div>
    </div>
  );
}
