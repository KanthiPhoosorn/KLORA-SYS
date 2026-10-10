import Link from "next/link";
import { Truck } from "lucide-react";
import { getCarrierLink, getSupplier } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { carrierLabel } from "@/lib/carriers";
import AttachCarrier from "@/components/AttachCarrier";

export const dynamic = "force-dynamic";
export const metadata = { title: "ชวนส่งสินค้าผ่าน Corta" };

// /c/<token> — a carrier's sign-up link (made on /logistic/incoming). A new farm signs up through it; a farm
// that already has an account signs in and binds itself to the carrier. Either way the farm then ships
// only with this carrier (enforced on the server — lib/carrier-lock).
export default async function CarrierLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [link, user] = await Promise.all([getCarrierLink(token), getCurrentUser()]);
  const open = link && !link.revokedAt ? link : null;
  const company = open?.company ?? (open ? carrierLabel(open.carrierKey) : "");
  const farm = user?.role === "supplier" && user.supplierId ? await getSupplier(user.supplierId) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/corta-logo.png" alt="Corta" className="h-7 w-auto" />
        {!open ? (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-900">ลิงก์นี้ถูกปิดแล้ว</h1>
            <p className="text-[14px] text-slate-500">ขอลิงก์ใหม่จากผู้ขนส่งของคุณ หรือสมัครใช้งานแบบปกติ</p>
            <Link href="/register" className="inline-block text-[14px] font-medium text-brand-pink hover:underline">สมัครใช้งาน</Link>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600"><Truck size={22} /></span>
              <div>
                <h1 className="text-[20px] font-semibold leading-snug text-slate-900">{company} ชวนคุณส่งสินค้าผ่าน Corta</h1>
                <p className="mt-1 text-[13px] text-slate-500">{carrierLabel(open.carrierKey)}{open.branch ? ` · ${open.branch}` : ""}</p>
              </div>
            </div>
            <p className="text-[14px] leading-relaxed text-slate-600">
              เมื่อเข้าร่วมผ่านลิงก์นี้ รอบส่งออกของฟาร์มคุณจะส่งกับ <b>{company}</b> และระบบคำนวณคาร์บอนพร้อมออกฉลาก QR ให้ทุกล็อต
            </p>
            {farm ? (
              <AttachCarrier token={open.token} company={company} farmName={farm.farmName} boundTo={farm.carrierOrg ? (farm.carrierOrg === open.orgCode ? "same" : farm.carrierCompany ?? "ผู้ขนส่งรายอื่น") : null} />
            ) : user ? (
              <p className="rounded-[8px] bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">บัญชีที่เข้าสู่ระบบอยู่ไม่ใช่บัญชีฟาร์ม — ออกจากระบบ แล้วเปิดลิงก์นี้อีกครั้งด้วยบัญชีฟาร์ม</p>
            ) : (
              <div className="space-y-2.5">
                <Link href={`/register?c=${open.token}`} className="block rounded-[8px] bg-brand-pink px-4 py-3 text-center text-[14px] font-semibold text-white hover:opacity-90">สมัครใช้งาน (ฟาร์มใหม่)</Link>
                <Link href={`/login?next=${encodeURIComponent(`/c/${open.token}`)}`} className="block rounded-[8px] border border-slate-300 px-4 py-3 text-center text-[14px] font-medium text-slate-700 hover:bg-slate-50">มีบัญชีฟาร์มอยู่แล้ว · เข้าสู่ระบบ</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
