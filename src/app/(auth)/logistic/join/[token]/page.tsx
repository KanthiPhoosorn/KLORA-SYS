import Link from "next/link";
import { LinkIcon } from "lucide-react";
import LogisticSignupForm from "@/components/LogisticSignupForm";
import { orgByJoinToken } from "@/lib/logistic-org";

export const metadata = { title: "ลงทะเบียนสาขา · Corta" };
export const dynamic = "force-dynamic";

// /logistic/join/<token> — a branch signs up through its company's link (doc "Logistic" แบบที่ 2, 17 Oct
// 2026). One link per company; the head office can make a new one (the old one stops) or close it.
export default async function BranchJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const org = await orgByJoinToken(decodeURIComponent(token));
  const open = !!org && org.status !== "rejected" && org.status !== "suspended";
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 lg:px-10">
        <Link href="/logistic/login" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corta-logo.png" alt="Corta" className="h-7 w-auto" />
        </Link>
        <Link href="/logistic/login" className="text-sm text-slate-600 hover:text-brand-blue">เข้าสู่ระบบ</Link>
      </header>
      <div className="flex flex-1 items-start justify-center px-4 py-8 sm:py-10">
        {open ? (
          <LogisticSignupForm mode="branch" company={org.company} token={org.joinToken} />
        ) : (
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-slate-100 text-slate-500"><LinkIcon size={24} /></span>
            <h1 className="mt-4 text-xl font-bold text-slate-900">ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
            <p className="mt-2 text-[14px] text-slate-600">ลิงก์ลงทะเบียนสาขาถูกปิดหรือเปลี่ยนใหม่แล้ว กรุณาขอลิงก์ใหม่จากสำนักงานใหญ่ของบริษัท</p>
            <Link href="/logistic/login" className="mt-6 inline-block rounded-lg border border-slate-300 px-5 py-2 text-[14px] text-slate-700 hover:bg-slate-50">ไปหน้าเข้าสู่ระบบ</Link>
          </div>
        )}
      </div>
    </div>
  );
}
