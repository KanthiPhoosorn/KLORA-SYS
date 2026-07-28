# KLORA ระบบตรวจสอบคาร์บอนการขนส่งดอกไม้

Carbon traceability for cut flowers, from farm to doorstep. Every flower batch is issued a
**SUP ID** and a **QR code** that reports its **CO₂e per flower** and **freshness age** (days
after cutting) — transparent across the whole chain: **ต้นน้ำ → กลางน้ำ → ปลายน้ำ**.

> Implements the flowchart *"ระบบปฏิบัติการการขนส่งดอกไม้"* (upstream farm · midstream KYN · downstream Thai Post).

## Roles & workspaces

| Role | เข้าที่ | หน้าที่ |
|------|--------|---------|
| **ต้นน้ำ / SUP (ฟาร์ม)** | `/login` · `/register` → `/app` | สมัคร/เข้าสู่ระบบ → ภาพรวม · กรอกรอบส่งออก (ประมาณระยะทางอัตโนมัติ) · แดชบอร์ดคาร์บอน · ประวัติ · แก้ไขข้อมูลฟาร์ม |
| **กลางน้ำ / KYN** | `/kyn` | ภาพรวมระบบ · ข้อมูลที่รับเข้า (กด **คำนวณ**) · รายงานสรุป + Export CSV · จัดการ SUP (ระงับ/เปิดใช้) · Shipment/QR log |
| **ปลายน้ำ / Thai Post** | `/thaipost` | ค้นหา SUP ID → **QR Label** (แบรนด์ KLORA) → พิมพ์ · ประวัติการพิมพ์ · สรุปวันนี้ |
| **Carbon Passport** | `/trace/[batchId]` | หน้าที่ QR พาไป — ที่มา · คาร์บอน · อายุของดอกไม้ (สำหรับผู้บริโภค) |

The SUP workspace requires login; KYN and Thai Post are operator consoles. Demo account:
**`farm`** / **`password123`**.

## Flow

SUP submits a round (`status: submitted`, freshness age computed immediately) → KYN receives it in
**ข้อมูลที่รับเข้า** and runs the carbon calculation (`ยืนยันทั้งหมดที่พร้อมคำนวณ` → `status: computed`) →
Thai Post prints the QR label (logged to the Shipment/QR log) → the QR resolves to the public passport.

## Formulas

```
CO₂e/ดอก = (คาร์บอนปลูก + คาร์บอนขนส่ง) / จำนวนดอกในตะกร้า
         + (คาร์บอนตะกร้า / จำนวนรอบใช้งาน) / จำนวนดอกในตะกร้า

คาร์บอนปลูก  = Fuel·2.68 + Electricity·0.50 + Fertilizer·1.30   (kg CO₂e)
คาร์บอนขนส่ง = ระยะทาง(km)·0.20
คาร์บอนตะกร้า = 2.0 / Reuse Cycle

อายุ (วัน)   = วันที่ลงข้อมูล − วันที่ตัด
```

Emission factors are documented placeholders in [`src/lib/carbon.ts`](src/lib/carbon.ts). *(Assumption:
the basket term is normalised per-flower so the result is a single CO₂e-per-flower figure.)*

## Stack

- **Next.js 16** (App Router) · **TypeScript** · **React 19** · **Tailwind CSS v4** · **lucide-react**
- **Real auth, no database** — passwords are scrypt-hashed and the session is a tamper-proof signed
  cookie ([`src/lib/auth.ts`](src/lib/auth.ts)); users/suppliers/batches/prints live in a JSON-file
  store at [`data/`](data/). Swap [`src/lib/store.ts`](src/lib/store.ts) for a real DB without touching the UI.
- **`qrcode`** for server-side QR (`/api/qr`).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Set `KLORA_SESSION_SECRET` in production (a dev fallback is used otherwise). The repo ships with
seed farms, batches, a demo user and print logs so every screen renders on first run.

## Project layout

```
src/
  app/
    page.tsx                 landing / role chooser
    (auth)/login · register  SUP sign-in / sign-up
    app/                     SUP workspace (guarded): overview · new · dashboard · history · farm
    kyn/                     KYN console: overview · incoming · report · suppliers · qrlog
    thaipost/                Thai Post console: search+print · history · today
    trace/[batchId]/         public carbon passport (QR target)
    api/                     auth · suppliers · batches · prints · qr
  components/                ConsoleShell · SidebarNav · ui · forms · QrLabel · …
  lib/                       types · store · auth · ids · carbon · geo · format · status · qr
data/                        JSON store (seeded): suppliers · batches · users · prints
```

## API

| Method | Route | ทำอะไร |
|--------|-------|--------|
| `POST` | `/api/auth/register` | สร้างฟาร์ม + บัญชี → ออก SUP ID → เข้าสู่ระบบ |
| `POST` | `/api/auth/login` · `/api/auth/logout` | เข้าสู่ระบบ / ออกจากระบบ |
| `GET` | `/api/suppliers` · `/api/suppliers/[id]` | รายชื่อฟาร์ม / ฟาร์ม + รอบการตัด |
| `PATCH` | `/api/suppliers/[id]` | แก้ไขข้อมูลฟาร์ม / ตั้งค่าคำนวณ / ระงับ-เปิดใช้ |
| `GET` · `POST` | `/api/batches` | รายการรอบ / เพิ่มรอบ (session-scoped) |
| `PATCH` | `/api/batches/[id]` | `action: compute` (KYN) หรืออัปเดตสถานะขนส่ง |
| `GET` · `POST` | `/api/prints` | Shipment/QR log |
| `GET` | `/api/qr?data=…` | QR code (SVG) |
