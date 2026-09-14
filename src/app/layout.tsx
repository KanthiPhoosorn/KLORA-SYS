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
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://corta.tech"),
  title: "KLORA · ระบบตรวจสอบคาร์บอนการขนส่งดอกไม้",
  description: "ระบบปฏิบัติการการขนส่งดอกไม้",
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
