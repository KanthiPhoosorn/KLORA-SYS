import LoginForm from "@/components/LoginForm";
import AuthLogo from "@/components/auth/AuthLogo";

export const metadata = { title: "เข้าสู่ระบบ · Corta" };

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen">
      <AuthLogo />
      {/* Left — hero illustration (desktop only) */}
      <div className="relative hidden w-[63%] shrink-0 overflow-hidden bg-emerald-50 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/login-hero.png"
          alt="Corta farm"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center bg-white px-8 pb-10 pt-20 lg:py-10">
        <LoginForm showGoogle portal="supplier" />
      </div>
    </div>
  );
}
