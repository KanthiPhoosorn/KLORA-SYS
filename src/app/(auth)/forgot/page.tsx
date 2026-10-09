import AuthShell from "@/components/auth/AuthShell";
import ForgotFlow from "@/components/auth/ForgotFlow";

export const metadata = { title: "ลืมรหัสผ่าน · Corta" };

export default function ForgotPage() {
  return (
    <AuthShell>
      <ForgotFlow />
    </AuthShell>
  );
}
