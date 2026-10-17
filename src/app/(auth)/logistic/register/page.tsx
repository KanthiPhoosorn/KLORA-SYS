import Link from "next/link";
import LogisticSignupForm from "@/components/LogisticSignupForm";
import { getCompanyInvite } from "@/lib/logistic-org";

export const metadata = { title: "ลงทะเบียน · Logistic · Corta" };

// Logistic portal register — same blue chrome as the login. The form is the company sign-up (doc "Logistic"
// แบบที่ 1, 17 Oct 2026); through KYN's invite link (?invite=…) the company is active at once.
export const dynamic = "force-dynamic";

export default async function LogisticRegisterPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const asked = ((await searchParams).invite ?? "").toUpperCase();
  const inv = asked ? await getCompanyInvite() : null;
  const invite = inv && inv.token === asked ? asked : undefined;
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top bar */}
      <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-gray-100 px-6 lg:px-10">
        <Link href="/logistic/login" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corta-logo.png" alt="Corta" className="h-7 w-auto" />
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[12px] font-semibold text-brand-blue">Logistic</span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-slate-600">
          <span className="h-6 w-px bg-gray-200" />
          <Link href="/logistic/login" className="hover:text-brand-blue">เข้าสู่ระบบ</Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left — blue hero with headline + logistics illustration */}
        <div className="relative hidden w-[58%] shrink-0 flex-col overflow-hidden bg-[#ebf6f8] lg:flex">
          <div className="px-12 pt-16">
            <h1 className="text-[40px] font-extrabold leading-[1.15] tracking-tight">
              <span className="text-slate-800">ส่งต่อความสดใหม่</span>
              <br />
              <span className="text-brand-green">ถึงทุกปลายทาง</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-500">
              จัดการการจัดส่งดอกไม้ตั้งแต่ต้นทาง
              <br />
              พร้อมติดตามข้อมูลในทุกขั้นตอนกับ Corta
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma/logistic-login-hero.png"
            alt="การจัดส่งดอกไม้"
            className="mt-auto w-full object-contain"
          />
        </div>

        {/* Right — form */}
        <div className="flex flex-1 items-start justify-center bg-slate-50 px-4 py-8 sm:px-8 sm:py-10">
          <LogisticSignupForm mode="company" invite={invite} />
        </div>
      </div>
    </div>
  );
}
