import Link from "next/link";

export const metadata = { title: "แนวคิดการเชื่อมข้อมูล Super App · KLORA" };

// One-page integration concept for the Thai Post Super App / Interface team (18 Sep 2026).
// Plain, honest about what exists today vs. what is a prototype vs. what needs their input.
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 mb-3 text-lg font-bold text-slate-900">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3 leading-7 text-slate-700">{children}</p>;
const Box = ({ title, children, tone = "slate" }: { title: string; children: React.ReactNode; tone?: "slate" | "green" | "amber" | "pink" }) => {
  const t = { slate: "border-slate-200 bg-white", green: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50", pink: "border-pink-200 bg-pink-50" }[tone];
  return <div className={`rounded-2xl border p-4 ${t}`}><div className="text-[13px] font-semibold text-slate-900">{title}</div><div className="mt-1 text-[13px] leading-6 text-slate-600">{children}</div></div>;
};

export default function SuperAppConceptPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-[60px] items-center justify-between border-b border-slate-200 px-6">
        <div className="flex items-center gap-3"><span className="text-lg font-extrabold tracking-tight text-brand-pink">KLORA</span><span className="text-sm text-slate-500">แนวคิดการเชื่อมข้อมูลกับ Super App</span></div>
        <Link href="/superapp" className="text-sm font-medium text-brand-pink hover:underline">← ดูต้นแบบหน้าจอ</Link>
      </header>
      <main className="mx-auto max-w-[820px] px-6 py-10 text-[15px]">
        <h1 className="text-[28px] font-bold leading-tight text-slate-900">ให้ลูกค้าดูข้อมูลสินค้าจากรายการสั่งซื้อ โดยไม่ต้องสแกน QR</h1>
        <P>วันนี้ลูกค้าปลายทางเห็นข้อมูลสินค้าด้วยการสแกน QR บนกล่อง (Journey 01) แนวคิดนี้เพิ่มช่องทางที่สอง: ใน Super App เมื่อลูกค้าเปิดออเดอร์ของตัวเอง แอปดึงข้อมูลชุดเดียวกันจาก KLORA มาแสดงในหน้ารายละเอียดสินค้า (Journey 02) — ข้อมูลอยู่ที่ KLORA ที่เดียว ไม่ต้องคัดลอกไปเก็บซ้ำ</P>

        <H>1. ตัวเชื่อม (Key) ระหว่างสองระบบ</H>
        <div className="grid gap-3 sm:grid-cols-3">
          <Box title="Batch ID (KLORA)" tone="pink">รหัสรอบส่งออก เช่น <code>BAT-2026-0007</code> — เป็นรหัสเดียวกับที่ฝังใน QR บนกล่อง (URL <code>/trace/&lt;Batch ID&gt;</code>) 1 batch = สินค้า 1 ชนิดจากฟาร์ม 1 แห่ง 1 รอบเก็บเกี่ยว</Box>
          <Box title="Item / Tracking ID (ไปรษณีย์)">รหัสสินค้าหรือเลขพัสดุในออเดอร์ของ Super App — ต้องเก็บ Batch ID ไว้กับรายการสินค้านั้น ณ ตอนที่ไปรษณีย์รับสินค้าและพิมพ์ QR (จุดเดียวกับที่ระบบ KLORA บันทึกการพิมพ์อยู่แล้ว)</Box>
          <Box title="Order ID (ไปรษณีย์)">ออเดอร์ 1 ใบมีได้หลาย Item → หลาย Batch ID · KLORA ไม่ต้องรู้จัก Order ID</Box>
        </div>
        <P>สรุป: <b>ตอนพิมพ์ QR ให้บันทึก Batch ID ลงในรายการสินค้าของออเดอร์</b> หลังจากนั้นทุกหน้าจอที่มี Batch ID เรียกข้อมูลจาก KLORA ได้ทันที</P>

        <H>2. Data flow</H>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-[12.5px] leading-6 text-slate-700">
{`ฟาร์ม ──กรอกรอบส่งออก──▶ KLORA (batch + CO₂e + ข้อมูลผลผลิต)
                              │
ไปรษณีย์รับสินค้า ──พิมพ์ QR──▶ KLORA บันทึกการพิมพ์ ──▶ Super App เก็บ Batch ID ไว้กับ Item
                              │
ลูกค้า ─ Journey 01: สแกน QR ──▶ https://corta.tech/trace/{batchId}   (หน้าเว็บ)
ลูกค้า ─ Journey 02: เปิดออเดอร์ ──▶ Super App เรียก GET https://corta.tech/api/trace/{batchId} (JSON) ──▶ แสดงในแอป`}
        </div>

        <H>3. API ที่มีให้แล้ววันนี้</H>
        <Box title="GET /api/trace/{batchId}  — สาธารณะ อ่านอย่างเดียว ไม่ต้องใช้ key" tone="green">
          ตอบ JSON ชุดเดียวกับหน้า QR: ประเภท/ชนิด/พันธุ์/เกรด · จำนวน+หน่วย · วันปลูก/เก็บเกี่ยว · อายุ ณ วันที่เรียก · ระยะการสุกตอนนี้ · อายุการเก็บคงเหลือ · อุณหภูมิเก็บ + คำเตือน · CO₂e ต่อหน่วยและรวม (แยกฟาร์ม/บรรจุภัณฑ์/ขนส่ง) · แหล่งผลิต + ใบรับรอง · สถานะขนส่ง · ลิงก์หน้าเต็ม<br />
          ไม่มีข้อมูลส่วนบุคคล (ไม่มีเบอร์โทร/พิกัด/บัญชี) · CORS เปิด · cache 60 วินาที · ตัวอย่าง: <a className="text-brand-pink underline" href="/api/trace/BAT-2026-0007" target="_blank" rel="noopener">/api/trace/BAT-2026-0007</a>
        </Box>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Box title="ทำได้แล้ว (ใช้งานจริงบน corta.tech)" tone="green">ฟาร์มกรอกรอบส่งออก 3 ประเภทสินค้า · คำนวณ CO₂e · พิมพ์ QR · หน้า /trace · JSON API ข้างบน · ระบบสมาชิก/สิทธิ์</Box>
          <Box title="ต้นแบบ (หน้าจอจำลอง)" tone="amber">หน้า Super App ทั้งหมดใน <Link href="/superapp" className="underline">/superapp</Link> — เมนู, My Item, ออเดอร์ เป็นภาพจำลอง; เฉพาะกล่อง “ข้อมูลจากระบบ KLORA” ดึงข้อมูลจริง</Box>
        </div>

        <H>4. สิ่งที่ต้องหารือกับทีม Super App / Interface</H>
        <ol className="list-decimal space-y-2 pl-6 leading-7 text-slate-700">
          <li>Super App มีข้อมูล Order / Item / Customer / Supplier อะไรอยู่แล้ว และรายการสินค้า (Item) มีช่องเก็บรหัสอ้างอิงภายนอกหรือไม่</li>
          <li>จุดที่ไปรษณีย์พิมพ์ QR ปัจจุบันใช้ระบบไหน — จะให้บันทึก Batch ID ลงออเดอร์อัตโนมัติได้อย่างไร (สแกน / API / manual)</li>
          <li>รูปแบบการเรียกข้อมูล: แอปเรียก KLORA ตรง (JSON ข้างบน) หรือผ่าน gateway ของไปรษณีย์ · ต้องการ API key / rate limit / IP allowlist หรือไม่</li>
          <li>รูปแบบ QR / Label / Name Tag ที่จะใช้จริง — ขนาด, ข้อมูลบน label, จะฝัง URL เดิม (<code>/trace/…</code>) หรือ deep link เข้า Super App</li>
          <li>Supplier กลุ่มแรกจาก ThaiPostMart สำหรับ POC และปริมาณต่อวันโดยประมาณ</li>
          <li>ข้อมูลที่ไปรษณีย์อยากให้เพิ่มในหน้าลูกค้า (เช่น เวลารับ-ส่ง, อุณหภูมิระหว่างทาง) — KLORA รับข้อมูลกลับผ่าน API ได้ถ้ามี</li>
        </ol>

        <H>5. ตัวอย่างการตอบของ API (ย่อ)</H>
        <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-4 text-[12px] leading-6 text-slate-100">{`{
  "batchId": "BAT-2026-0007",
  "product": { "category": "fruit", "categoryLabel": "ผลไม้", "type": "มะม่วง", "variety": "น้ำดอกไม้สีทอง", "grade": "ส่งออก" },
  "quantity": { "value": 240, "unit": "kg", "unitLabel": "กก." },
  "dates": { "plantingDate": "2021-06-10", "harvestDate": "2026-09-15", "daysSinceHarvest": 1 },
  "freshness": { "ripeness": "turning", "ripenessLabel": "เริ่มสุก", "shelfLifeLeftDays": 13, "storageMinC": 10, "storageMaxC": 13 },
  "carbon": { "perUnit": 0.351, "perUnitLabel": "ต่อกก.", "totalKg": 84.3, "breakdown": { "farm": 56.7, "packaging": 12.0, "transport": 15.7 } },
  "origin": { "farmName": "สวนผลไม้และผักดอยฝาง", "province": "เชียงใหม่", "certifications": [{ "kind": "GAP", "certNo": "กษ 03-9001-50320-0117" }] },
  "shipment": { "status": "in_transit", "destination": "กรุงเทพฯ", "distanceKm": 690, "reefer": false },
  "links": { "passport": "https://corta.tech/trace/BAT-2026-0007" }
}`}</pre>
      </main>
    </div>
  );
}
