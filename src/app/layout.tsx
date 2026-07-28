import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KLORA · ระบบตรวจสอบคาร์บอนการขนส่งดอกไม้",
  description:
    "ระบบปฏิบัติการการขนส่งดอกไม้ — ต้นน้ำ (ฟาร์ม) · กลางน้ำ (KYN) · ปลายน้ำ (Thai Post)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
