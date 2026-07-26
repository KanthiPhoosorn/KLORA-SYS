# KLORA·SYS — ระบบตรวจสอบคาร์บอนการขนส่งดอกไม้

Carbon traceability for cut flowers, from farm to doorstep. Every flower batch is issued a
**SUP ID** and a **QR code** that reports its **CO₂e per flower** and **freshness age** (days
after cutting) — transparent across the whole chain: **ต้นน้ำ → กลางน้ำ → ปลายน้ำ**.

> Implements the flowchart *"ระบบปฏิบัติการการขนส่งดอกไม้"* (upstream farm · midstream KYN×Outsource · downstream Thai Post).

## The three lanes

| Lane | ผู้เกี่ยวข้อง | หน้าที่ |
|------|--------------|---------|
| **ต้นน้ำ / Farm** (`/farm`) | Supplier (ฟาร์ม) | สแกน QR → สมัคร → กรอกข้อมูลฟาร์ม → ระบบสร้าง **SUP ID** → ลงข้อมูลรอบการตัด (จำนวนดอก · วันที่ตัด · ระยะทาง) |
| **กลางน้ำ / KYN** (`/kyn`) | KYN×Outsource | รับข้อมูล → คัดแยก → **คำนวณคาร์บอน + อายุดอกไม้** → รวบรวมและแสดงผล |
| **ปลายน้ำ / Thai Post** (`/thaipost`) | Thai Post | ค้นหา **SUP ID** → สร้าง **QR Label** → พิมพ์ติดพัสดุ |
| **Carbon Passport** (`/trace/[batchId]`) | ผู้บริโภค | หน้าที่ QR พาไป — ที่มา · คาร์บอน · อายุของดอกไม้ |

## Formulas

```
CO₂e/ดอก = (คาร์บอนปลูก + คาร์บอนขนส่ง) / จำนวนดอกในตะกร้า
         + (คาร์บอนตะกร้า / จำนวนรอบใช้งาน) / จำนวนดอกในตะกร้า

คาร์บอนปลูก  = Fuel·2.68 + Electricity·0.50 + Fertilizer·1.30   (kg CO₂e)
คาร์บอนขนส่ง = ระยะทาง(km)·0.20
คาร์บอนตะกร้า = 2.0 / Reuse Cycle

อายุ (วัน)   = วันที่ลงข้อมูล − วันที่ตัด
```

Emission factors are documented placeholders in [`src/lib/carbon.ts`](src/lib/carbon.ts) — edit
them there. *(Assumption: the basket term is normalised per-flower so the result is a single
CO₂e-per-flower figure.)*

## Stack

- **Next.js 16** (App Router) · **TypeScript** · **React 19**
- **Tailwind CSS v4** · **lucide-react** icons
- **`qrcode`** for server-side QR (`/api/qr`)
- **No database** — a JSON-file store at [`data/`](data/) (`suppliers.json`, `batches.json`).
  Swap [`src/lib/store.ts`](src/lib/store.ts) for SQLite/Drizzle later without touching the UI.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

The repo ships with seed farms + batches so every screen renders on first run.

## Project layout

```
src/
  app/
    page.tsx                 ภาพรวม / dashboard
    farm/                    ต้นน้ำ — register + batch entry
    kyn/                     กลางน้ำ — results table + aggregate + factors
    thaipost/                ปลายน้ำ — search + printable QR label
    trace/[batchId]/         public carbon passport (QR target)
    api/                     suppliers · batches · qr route handlers
  components/                Nav · ui · SupplierForm · BatchForm · CarbonResult · QrLabel
  lib/                       types · store · ids · carbon · qr
data/                        JSON store (seeded)
```

## API

| Method | Route | ทำอะไร |
|--------|-------|--------|
| `GET` | `/api/suppliers` | รายชื่อฟาร์ม |
| `POST` | `/api/suppliers` | ลงทะเบียนฟาร์ม → ออก SUP ID |
| `GET` | `/api/suppliers/[id]` | ฟาร์ม + รอบการตัดของฟาร์มนั้น |
| `GET` | `/api/batches` | รอบการตัด (กรองด้วย `?supplierId=`) |
| `POST` | `/api/batches` | เพิ่มรอบการตัด → คำนวณคาร์บอน + อายุ |
| `GET` | `/api/qr?data=…` | QR code (SVG) |
