"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowUpRight } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: fd.get("login"),
          password: fd.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="text-sm font-medium text-slate-400">ต้นน้ำ · SUP</div>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">ชื่อผู้ใช้ / อีเมล</span>
          <input
            name="login"
            required
            autoComplete="username"
            placeholder="username"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">รหัสผ่าน</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="password"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          เข้าสู่ระบบ <ArrowUpRight size={16} />
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="font-medium text-blue-600 hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  );
}
