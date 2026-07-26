import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplier, getBatchesBySupplier } from "@/lib/store";
import { Card, CardHeader, Badge } from "@/components/ui";
import BatchForm from "@/components/BatchForm";
import CarbonResult from "@/components/CarbonResult";
import {
  Sprout,
  MapPin,
  User,
  Phone,
  Star,
  QrCode,
  ArrowUpRight,
  Fuel,
  Zap,
  Sprout as Leaf2,
  RefreshCw,
} from "lucide-react";

export const dynamic = "force-dynamic";

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 py-1.5 text-sm">
      <span className="mt-0.5 text-pink-600">{icon}</span>
      <span className="w-28 shrink-0 text-pink-900/50">{label}</span>
      <span className="font-medium text-pink-950">{value}</span>
    </div>
  );
}

export default async function SupplierDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  const batches = (await getBatchesBySupplier(id)).reverse();

  const optional = [
    supplier.fuelLitres != null && {
      icon: <Fuel size={14} />,
      label: "Fuel",
      value: `${supplier.fuelLitres} ลิตร/รอบ`,
    },
    supplier.electricityKwh != null && {
      icon: <Zap size={14} />,
      label: "Electricity",
      value: `${supplier.electricityKwh} kWh/รอบ`,
    },
    supplier.fertilizerKg != null && {
      icon: <Leaf2 size={14} />,
      label: "Fertilizer",
      value: `${supplier.fertilizerKg} kg/รอบ`,
    },
    supplier.reuseCycles != null && {
      icon: <RefreshCw size={14} />,
      label: "Reuse Cycle",
      value: `${supplier.reuseCycles} รอบ/ตะกร้า (${supplier.basketId ?? "—"})`,
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-pink-900/50">
        <Link href="/farm" className="hover:text-pink-700">
          ต้นน้ำ · ฟาร์ม
        </Link>
        <span>/</span>
        <span className="font-mono text-pink-700">{supplier.id}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Sprout size={18} />}
            title={supplier.farmName}
            subtitle={supplier.flowerType}
          />
          <div className="px-5 py-4">
            <Row icon={<User size={14} />} label="เจ้าของ" value={supplier.owner} />
            <Row icon={<MapPin size={14} />} label="ที่อยู่" value={supplier.address} />
            <Row
              icon={<MapPin size={14} />}
              label="พิกัด GPS"
              value={`${supplier.gpsLat}, ${supplier.gpsLng}`}
            />
            <Row icon={<Phone size={14} />} label="ติดต่อ" value={supplier.contact} />
            <Row icon={<Star size={14} />} label="จุดเด่น" value={supplier.highlights} />

            {optional.length > 0 ? (
              <div className="mt-3 border-t border-pink-900/10 pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-pink-900/40">
                  ข้อมูลใช้คำนวณคาร์บอน
                </p>
                {optional.map((o, i) => (
                  <Row key={i} icon={o.icon} label={o.label} value={o.value} />
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        {/* Supplier QR */}
        <Card>
          <CardHeader icon={<QrCode size={18} />} title="SUP QR" subtitle="สแกนเพื่อค้นหา SUP ID" />
          <div className="flex flex-col items-center gap-3 px-5 py-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?data=${encodeURIComponent(supplier.id)}`}
              alt={`QR ${supplier.id}`}
              width={180}
              height={180}
              className="rounded-lg border border-pink-900/10 bg-white p-2"
            />
            <span className="font-mono text-sm font-semibold text-pink-700">
              {supplier.id}
            </span>
          </div>
        </Card>
      </div>

      {/* Batch entry */}
      <Card>
        <CardHeader
          title="ลงข้อมูลรอบการตัด (Batch)"
          subtitle="จำนวนดอก · วันที่ตัด · ระยะทาง — ระบบคำนวณคาร์บอน + อายุให้อัตโนมัติ"
        />
        <BatchForm supplierId={supplier.id} />
      </Card>

      {/* Batches list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-pink-900/70">
          รอบการตัดทั้งหมด ({batches.length})
        </h2>
        {batches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-pink-900/15 px-4 py-6 text-center text-sm text-pink-900/50">
            ยังไม่มีรอบการตัด — เพิ่มรอบแรกด้านบน
          </p>
        ) : (
          batches.map((b) => (
            <Card key={b.id}>
              <div className="flex items-center justify-between gap-3 border-b border-pink-900/10 px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-pink-700">
                    {b.id}
                  </span>
                  <Badge tone="neutral">ตัด {b.cutDate}</Badge>
                </div>
                <Link
                  href={`/trace/${b.id}`}
                  className="flex items-center gap-1 text-xs font-medium text-pink-600 hover:text-pink-800"
                >
                  ดูคาร์บอนพาสปอร์ต <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="px-5 py-4">
                <CarbonResult batch={b} />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
