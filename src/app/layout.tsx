import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "KLORA · ระบบตรวจสอบคาร์บอนการขนส่งดอกไม้",
  description:
    "ระบบปฏิบัติการการขนส่งดอกไม้ — ต้นน้ำ (ฟาร์ม) · กลางน้ำ (KYN×Outsource) · ปลายน้ำ (Thai Post)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
