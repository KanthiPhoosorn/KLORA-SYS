import { requireRole } from "@/lib/auth";
import { getFactors, getFactorsMeta, getUsers } from "@/lib/store";
import FactorsEditor from "@/components/FactorsEditor";
import { thaiDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

// ค่าสัมประสิทธิ์ (EF) — KYN keeps the reference factors the carbon engine uses: farm inputs,
// air freight (DEFRA), per-vehicle t.km, and the standard package sizes offered in the forms.
export default async function KynFactorsPage() {
  await requireRole("kyn");
  const [factors, meta, users] = await Promise.all([getFactors(), getFactorsMeta(), getUsers()]);
  const by = meta.updatedBy ? users.find((u) => u.id === meta.updatedBy)?.username ?? meta.updatedBy : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ค่าสัมประสิทธิ์การปล่อยก๊าซ (EF)</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          {meta.updatedAt ? `แก้ไขล่าสุด ${thaiDateTime(meta.updatedAt)}${by ? ` โดย ${by}` : ""}` : "ใช้ค่าเริ่มต้นของระบบ (ยังไม่เคยแก้ไข)"}
        </p>
      </div>
      <FactorsEditor initial={factors} />
    </div>
  );
}
