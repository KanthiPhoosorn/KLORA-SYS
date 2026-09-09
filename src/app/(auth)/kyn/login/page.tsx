import Link from "next/link";
import { BarChart3 } from "lucide-react";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "เข้าสู่ระบบ · KYN · KLORA" };

// KYN console login — purple-themed variant (matches the Figma KYN auth frame #90).
// Lives in the (auth) group so it is NOT wrapped by the guarded /kyn portal layout.
export default function KynLoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top bar */}
      <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-gray-100 px-6 lg:px-10">
        <Link href="/kyn/login" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
            <BarChart3 size={17} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-brand-purple">KYN</span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-slate-600">
          <span className="h-6 w-px bg-gray-200" />
          <Link href="/kyn/login" className="hover:text-brand-purple">เข้าสู่ระบบ</Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left — light-blue hero with the analytics illustration */}
        <div className="relative hidden w-[57%] shrink-0 items-center justify-center overflow-hidden bg-[#eaf1fc] lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma/kyn-login-hero.webp"
            alt="ภาพรวมระบบ KYN"
            className="w-full object-contain"
          />
        </div>

        {/* Right — form */}
        <div className="flex flex-1 items-center justify-center px-8 py-10">
          <LoginForm accent="purple" registerHref="/register" showGoogle size="lg" />
        </div>
      </div>
    </div>
  );
}
