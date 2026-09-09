import { requireRole } from "@/lib/auth";
import LogisticProfileForm from "@/components/LogisticProfileForm";

export const dynamic = "force-dynamic";

export default async function LogisticProfilePage() {
  const user = await requireRole("logistic");
  return (
    <LogisticProfileForm
      initial={{ username: user.username, email: user.email, phone: user.phone ?? "" }}
    />
  );
}
