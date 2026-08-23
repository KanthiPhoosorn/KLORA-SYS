import Link from "next/link";
import { Box } from "lucide-react";
import LogisticRegisterForm from "@/components/LogisticRegisterForm";

export const metadata = { title: "ลงทะเบียน · Logistic · KLORA" };

// Logistic portal register — same blue chrome as the login (matches the Figma Logistic Register frame).
export default function LogisticRegisterPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top bar */}
      <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-gray-100 px-6 lg:px-10">
        <Link href="/logistic/login" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-brand-blue text-white">
            <Box size={17} />
          </span>
          <span className="text-lg font-bold text-brand-blue">Logistic</span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-slate-600">
          <span className="h-6 w-px bg-gray-200" />
          <Link href="/logistic/login" className="hover:text-brand-blue">เข้าสู่ระบบ</Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left — blue hero with headline + logistics illustration */}
        <div className="relative hidden w-[58%] shrink-0 flex-col overflow-hidden bg-brand-blue-light lg:flex">
          <div className="px-12 pt-16">
            <h1 className="text-[40px] font-extrabold leading-[1.15] tracking-tight">
              <span className="text-slate-800">ส่งต่อความสดใหม่</span>
              <br />
              <span className="text-brand-green">ถึงทุกปลายทาง</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-500">
              จัดการการจัดส่งดอกไม้ตั้งแต่ต้นทาง
              <br />
              พร้อมติดตามข้อมูลในทุกขั้นตอนกับ KLORA
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
        <div className="flex flex-1 items-center justify-center px-8 py-10">
          <LogisticRegisterForm />
        </div>
      </div>
    </div>
  );
}
