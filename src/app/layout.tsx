import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KLORA · ระบบตรวจสอบคาร์บอนการขนส่งดอกไม้",
  description:
    "ระบบปฏิบัติการการขนส่งดอกไม้ — ต้นน้ำ (ฟาร์ม) · กลางน้ำ (KYN) · ปลายน้ำ (Logistic)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${inter.variable} ${notoThai.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
