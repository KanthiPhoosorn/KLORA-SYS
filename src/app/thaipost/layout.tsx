import Link from "next/link";
import { Package } from "lucide-react";
import TopBar from "@/components/TopBar";
import HelpButton from "@/components/HelpButton";

export default function ThaiPostLayout({ children }: { children: React.ReactNode }) {
  const left = (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">
        <Package size={17} />
      </span>
      <span className="text-sm font-bold text-slate-900">Thai Post</span>
    </Link>
  );
  return (
    <div className="min-h-screen">
      <TopBar left={left} right={<HelpButton />} />
      {children}
    </div>
  );
}
