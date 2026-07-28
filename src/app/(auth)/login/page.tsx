import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "เข้าสู่ระบบ · KLORA" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-2xl font-extrabold tracking-tight text-pink-500">
        KLORA
      </Link>
      <LoginForm />
    </div>
  );
}
