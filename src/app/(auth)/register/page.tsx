import RegisterForm from "@/components/auth/RegisterForm";
import AuthLogo from "@/components/auth/AuthLogo";
import { asCarrierKey, carrierLabel } from "@/lib/carriers";
import { getCarrierLink } from "@/lib/store";

export const metadata = { title: "สมัครสมาชิก · Corta" };

// /register?via=thaipost — a carrier's signup link: the farm will only ship with that carrier.
// /register?c=<token> — a carrier's own link (from /c/<token>): binds the farm to that carrier org.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ via?: string; c?: string }> }) {
  const sp = await searchParams;
  const link = sp.c ? await getCarrierLink(sp.c) : null;
  const open = link && !link.revokedAt ? link : null;
  const via = open ? open.carrierKey : asCarrierKey(sp.via);
  const viaLabel = open ? [open.company ?? carrierLabel(open.carrierKey), open.branch].filter(Boolean).join(" · ") : via ? carrierLabel(via) : undefined;
  return (
    <div className="relative min-h-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/register-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <AuthLogo />
      <div className="relative flex min-h-screen items-center justify-center px-4 pb-10 pt-20 lg:py-10">
        <RegisterForm via={via} viaLabel={viaLabel} linkToken={open?.token} linkClosed={!!sp.c && !open} />
      </div>
    </div>
  );
}
