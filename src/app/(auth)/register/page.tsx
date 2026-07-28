import Link from "next/link";
import RegisterForm from "@/components/RegisterForm";

export const metadata = { title: "สมัครสมาชิก · KLORA" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-2xl font-extrabold tracking-tight text-pink-500">
        KLORA
      </Link>
      <RegisterForm />
    </div>
  );
}
