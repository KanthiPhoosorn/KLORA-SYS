import { requireRole } from "@/lib/auth";
import { getCatalog } from "@/lib/store";
import CatalogEditor from "@/components/CatalogEditor";

export const dynamic = "force-dynamic";

// ตารางบรรจุภัณฑ์ (KYN ดูแล) — Thai Post doc 9 Oct 2026 §4.9: per kind & size the standard weight,
// material and lifetime; per material the EF (kg CO₂e / kg). Users never type these.
export default async function KynPackagingPage() {
  await requireRole("kyn");
  const catalog = await getCatalog();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตารางบรรจุภัณฑ์</h1>
        <p className="mt-1 text-[13px] text-slate-500">น้ำหนักมาตรฐานแต่ละขนาด วัสดุหลัก จำนวนรอบใช้งาน และค่า EF ของวัสดุ — ใช้คำนวณคาร์บอนบรรจุภัณฑ์ของทุกรอบส่งออก</p>
      </div>
      <CatalogEditor initial={catalog} />
    </div>
  );
}
