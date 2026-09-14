import Link from "next/link";
import { getInviteByToken, getSupplier, getUsers } from "@/lib/store";
import JoinForm from "@/components/auth/JoinForm";

export const metadata = { title: "ตอบรับคำเชิญ · KLORA" };
export const dynamic = "force-dynamic";

// /join/<token> — landing page of the invite email. Shows who is inviting and lets the
// invitee pick a username + password; the email is fixed to the invited address.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  let orgName = "";
  if (invite?.status === "pending") {
    orgName = invite.supplierId.startsWith("SUP-")
      ? (await getSupplier(invite.supplierId))?.farmName ?? ""
      : (await getUsers()).find((u) => u.id === invite.supplierId)?.company ?? "";
  }
  const problem = !invite
    ? "ลิงก์คำเชิญไม่ถูกต้อง"
    : invite.status === "accepted"
      ? "คำเชิญนี้ถูกตอบรับไปแล้ว"
      : invite.status === "cancelled"
        ? "คำเชิญนี้ถูกยกเลิกแล้ว"
        : !orgName
          ? "ไม่พบองค์กรที่เชิญ"
          : null;

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[63%] shrink-0 overflow-hidden bg-emerald-50 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/login-hero.png" alt="KLORA farm" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 items-center justify-center bg-white px-8 py-10">
        {problem ? (
          <div className="w-full max-w-[425px] space-y-4">
            <h1 className="text-[32px] font-semibold leading-[38px] text-black">ตอบรับคำเชิญ</h1>
            <p className="rounded-[5px] bg-brand-pink-light px-3 py-2 text-[12px] text-[#c1006e]">{problem}</p>
            <p className="text-[12px] text-black">
              มีบัญชีอยู่แล้ว? <Link href="/login" className="text-brand-pink underline">เข้าสู่ระบบ</Link>
            </p>
          </div>
        ) : (
          <JoinForm token={token} email={invite!.email} orgName={orgName} role={invite!.role} />
        )}
      </div>
    </div>
  );
}
