import LoginForm from "@/components/LoginForm";

export const metadata = { title: "เข้าสู่ระบบ · KLORA" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left — hero illustration (desktop only) */}
      <div className="relative hidden w-[63%] shrink-0 overflow-hidden bg-emerald-50 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/figma/login-hero.png"
          alt="KLORA farm"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center bg-white px-8 py-10">
        <LoginForm />
      </div>
    </div>
  );
}
