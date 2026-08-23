import { Bell, Factory } from "lucide-react";
import { requireRole } from "@/lib/auth";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import AccountButton from "@/components/portal/AccountButton";

export const dynamic = "force-dynamic";

const ITEMS: PortalNavItem[] = [
  { href: "/kyn", label: "ภาพรวม", icon: "home", exact: true },
  { href: "/kyn/incoming", label: "รายการรับเข้าจากผู้ผลิต", icon: "inbox" },
  { href: "/kyn/report", label: "รายงานสรุป", icon: "report" },
  { href: "/kyn/suppliers", label: "จัดการ SUP", icon: "users" },
  { href: "/kyn/qrlog", label: "Shipment / QR Log", icon: "qr" },
];

export default async function KynLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("kyn");

  const brandMark = (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
      <Factory size={16} />
    </span>
  );

  const header = (
    <>
      <div className="text-lg font-semibold text-slate-800">KYN Console</div>
      <div className="ml-auto flex items-center gap-4">
        <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Bell size={18} /></button>
        <AccountButton label="KYN ID" id={user.username} profileHref="/kyn/profile" />
      </div>
    </>
  );

  const footer = (
    <div className="m-3 overflow-hidden rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/70 p-4 text-center">
      <div className="text-4xl leading-none">🛰️</div>
      <div className="mt-2 text-xs font-medium text-slate-700">KLORA · กลางน้ำ</div>
      <div className="text-[11px] text-slate-500">KYN console</div>
    </div>
  );

  return (
    <PortalShell accent="slate" brand="KYN" brandMark={brandMark} items={ITEMS} header={header} footer={footer}>
      {children}
    </PortalShell>
  );
}
