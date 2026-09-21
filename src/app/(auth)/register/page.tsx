import RegisterForm from "@/components/auth/RegisterForm";
import { asCarrierKey, carrierLabel } from "@/lib/carriers";

export const metadata = { title: "สมัครสมาชิก · KLORA" };

// /register?via=thaipost — a carrier's signup link: the farm will only ship with that carrier.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ via?: string }> }) {
  const via = asCarrierKey((await searchParams).via);
  return (
    <div className="relative min-h-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/register-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <RegisterForm via={via} viaLabel={via ? carrierLabel(via) : undefined} />
      </div>
    </div>
  );
}
