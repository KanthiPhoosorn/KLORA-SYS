import Link from "next/link";
import { getSuppliers, getBatches } from "@/lib/store";
import { Card, CardHeader, Badge } from "@/components/ui";
import SupplierForm from "@/components/SupplierForm";
import { Sprout, MapPin, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FarmPage() {
  const [suppliers, batches] = await Promise.all([
    getSuppliers(),
    getBatches(),
  ]);
  const batchCount = (id: string) =>
    batches.filter((b) => b.supplierId === id).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-pink-950">
          <Sprout className="text-pink-600" /> ต้นน้ำ · ฟาร์ม
        </h1>
        <p className="mt-1 text-pink-900/60">
          สแกน QR → สมัครสมาชิก → กรอกข้อมูลพื้นฐาน → ระบบสร้าง SUP ID
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              icon={<Sprout size={18} />}
              title="ลงทะเบียนฟาร์ม (Supplier)"
              subtitle="กรอกข้อมูลเพื่อออก SUP ID"
            />
            <SupplierForm />
          </Card>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-pink-900/70">
            ฟาร์มในระบบ ({suppliers.length})
          </h2>
          {suppliers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-pink-900/15 px-4 py-8 text-center text-sm text-pink-900/50">
              ยังไม่มีฟาร์ม — ลงทะเบียนใบแรกได้เลย
            </p>
          ) : (
            [...suppliers].reverse().map((s) => (
              <Link key={s.id} href={`/farm/${s.id}`}>
                <Card className="transition hover:border-pink-400 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-pink-700">
                          {s.id}
                        </span>
                        <Badge tone="green">{batchCount(s.id)} รอบ</Badge>
                      </div>
                      <p className="mt-1 font-medium text-pink-950">
                        {s.farmName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-pink-900/50">
                        <MapPin size={12} /> {s.flowerType}
                      </p>
                    </div>
                    <ArrowUpRight className="text-pink-400" size={18} />
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
