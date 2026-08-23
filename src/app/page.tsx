import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Root is not a landing page — send visitors straight to login (or their portal if signed in).
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? homeForRole(user.role) : "/login");
}
