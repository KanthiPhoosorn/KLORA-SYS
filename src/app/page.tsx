import { getSuppliers, getBatches } from "@/lib/store";
import { Card, CardHeader, Stat, LinkButton } from "@/components/ui";
import {
  Sprout,
  Factory,
  Package,
  ArrowRight,
  Leaf,
  QrCode,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [suppliers, batches] = await Promise.all([
    getSuppliers(),
    getBatches(),
  ]);

  const totalFlowers = batches.reduce((n, b) => n + b.flowerCount, 0);
  const avgCo2e =
    batches.length > 0
      ? batches.reduce((n, b) => n + b.co2ePerFlower, 0) / batches.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-3xl border border-emerald-900/10 bg-white/60 p-8 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Leaf size={16} /> Carbon Traceability for Cut Flowers
        </div>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight text-emerald-950 sm:text-4xl">
          ระบบปฏิบัติการการขนส่งดอกไม้
          <span className="block text-emerald-600">
            รู้คาร์บอน รู้อายุดอกไม้ ตั้งแต่ฟาร์มถึงปลายทาง
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-emerald-900/70">
          ทุกช่อดอกไม้ได้รับ <b>SUP ID</b> และ <b>QR</b> ที่บอกค่า{" "}
          <b>CO₂e ต่อดอก</b> และ <b>อายุหลังตัด</b> — โปร่งใสตลอดสายส่ง
          ต้นน้ำ → กลางน้ำ → ปลายน้ำ
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/farm">
            <Sprout size={16} /> เริ่มที่ฟาร์ม (ลงทะเบียน SUP)
          </LinkButton>
          <LinkButton href="/kyn" variant="ghost">
            ดูผลคำนวณคาร์บอน <ArrowRight size={16} />
          </LinkButton>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="ฟาร์ม (SUP)" value={suppliers.length} />
        <Stat label="รอบการตัด (Batch)" value={batches.length} tone="blue" />
        <Stat
          label="ดอกไม้รวม"
          value={totalFlowers.toLocaleString()}
          unit="ดอก"
          tone="amber"
        />
        <Stat
          label="CO₂e เฉลี่ย/ดอก"
          value={avgCo2e.toFixed(3)}
          unit="kg"
        />
      </section>

      {/* The three lanes */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader
            icon={<Sprout size={18} />}
            title="ต้นน้ำ · ฟาร์ม"
            subtitle="Supplier / Farm"
          />
          <div className="space-y-2 px-5 py-4 text-sm text-emerald-900/70">
            <p>สแกน QR → สมัครสมาชิก → กรอกข้อมูลฟาร์ม → ระบบสร้าง SUP ID</p>
            <p className="text-emerald-900/50">
              ลงข้อมูลรอบการตัด: จำนวนดอก · วันที่ตัด · ระยะทางปลายทาง
            </p>
            <div className="pt-2">
              <LinkButton href="/farm" variant="ghost">
                ไปที่ฟาร์ม <ArrowRight size={14} />
              </LinkButton>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<Factory size={18} />}
            title="กลางน้ำ · KYN×Outsource"
            subtitle="Processing engine"
          />
          <div className="space-y-2 px-5 py-4 text-sm text-emerald-900/70">
            <p>รับข้อมูล → คัดแยก → คำนวณคาร์บอน + อายุดอกไม้ → แสดงผล</p>
            <p className="text-emerald-900/50">
              CO₂e/ดอก = (ปลูก + ขนส่ง)/จำนวนดอก + ตะกร้า/รอบใช้งาน
            </p>
            <div className="pt-2">
              <LinkButton href="/kyn" variant="ghost">
                ดูผลคำนวณ <ArrowRight size={14} />
              </LinkButton>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<Package size={18} />}
            title="ปลายน้ำ · Thai Post"
            subtitle="Label & dispatch"
          />
          <div className="space-y-2 px-5 py-4 text-sm text-emerald-900/70">
            <p>ค้นหา SUP ID → สร้าง QR Label → พิมพ์ QR ติดพัสดุ</p>
            <p className="flex items-center gap-1 text-emerald-900/50">
              <QrCode size={14} /> QR นำไปยังหน้า “คาร์บอนพาสปอร์ต” ของดอกไม้
            </p>
            <div className="pt-2">
              <LinkButton href="/thaipost" variant="ghost">
                สร้างฉลาก <ArrowRight size={14} />
              </LinkButton>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
