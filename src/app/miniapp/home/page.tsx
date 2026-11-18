import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, readMember } from "@/lib/thp-sso";
import MiniHome from "./MiniHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Corta",
  referrer: "no-referrer",
  robots: { index: false },
};

export default async function MiniHomePage() {
  const member = readMember((await cookies()).get(MEMBER_COOKIE)?.value);
  if (!member) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/corta-logo.png" alt="Corta" className="mb-6 h-12 w-auto" />
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-[15px] font-medium text-slate-700">กรุณาเปิด Corta จากแอปไปรษณีย์ไทย</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#EE2C34] px-4 pb-6 pt-5 text-white">
        <div className="mx-auto max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corta-logo-white.png" alt="Corta" className="mb-4 h-8 w-auto" />
          <h1 className="text-xl font-bold">{member.name ? `สวัสดี คุณ${member.name}` : "สวัสดี"}</h1>
          <p className="mt-1 text-[14px] leading-6 text-white/90">ดูที่มาของสินค้าเกษตร วันเก็บเกี่ยว และคาร์บอนของสินค้าที่ส่งผ่านไปรษณีย์ไทย</p>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-5">
        <MiniHome />
        <p className="mt-8 text-center text-xs text-slate-400">
          <Link href="/privacy" className="underline">ข้อมูลส่วนบุคคล</Link>
        </p>
      </main>
    </div>
  );
}
