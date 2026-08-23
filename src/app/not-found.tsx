import Link from "next/link";

// Custom 404.
export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="text-6xl font-extrabold tracking-tight text-brand-pink">404</div>
        <h1 className="mt-2 text-xl font-bold text-slate-900">ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="mt-2 text-sm text-slate-500">หน้านี้อาจถูกย้ายหรือไม่มีอยู่แล้ว</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-[8px] bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}
