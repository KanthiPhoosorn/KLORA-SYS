import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = { title: "สมัครสมาชิก · KLORA" };

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/register-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <RegisterForm />
      </div>
    </div>
  );
}
