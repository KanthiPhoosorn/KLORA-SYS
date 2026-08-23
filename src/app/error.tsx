"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Route-segment error boundary. Catches render/runtime errors and offers a retry.
// This is where a Sentry captureException() would hook in once a DSN is configured.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(Tier-2 monitoring): forward to Sentry here.
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-pink-light text-brand-pink">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">เกิดข้อผิดพลาดบางอย่าง</h1>
        <p className="mt-2 text-sm text-slate-500">
          ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาโปรดติดต่อผู้ดูแลระบบ
        </p>
        {error.digest ? <p className="mt-1 text-xs text-slate-400">รหัสอ้างอิง: {error.digest}</p> : null}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-[8px] bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            ลองอีกครั้ง
          </button>
          <Link
            href="/"
            className="rounded-[8px] border border-gray-300 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-gray-100"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}
