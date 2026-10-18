import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { parseCat } from "@/components/CategoryFilter";
import LogisticDashboard from "@/components/LogisticDashboard";

export const dynamic = "force-dynamic";

export default async function LogisticHome({ searchParams }: { searchParams: Promise<{ cat?: string; branch?: string }> }) {
  const user = await requireRole("logistic");
  const sp = await searchParams;
  // a branch's own dashboard now lives under ข้อมูลรายสาขา (doc "Logistic", 18 Oct 2026); old links still work
  if (sp.branch) redirect(`/logistic/branches/${encodeURIComponent(sp.branch)}${sp.cat ? `?cat=${encodeURIComponent(sp.cat)}` : ""}`);
  return <LogisticDashboard user={user} cat={parseCat(sp.cat)} />;
}
