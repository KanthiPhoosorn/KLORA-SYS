"use client";

import { useEffect, useState } from "react";

// After "too many tries" (429 with retryAfter) a sign-in / sign-up form waits: the button stays off and a
// line counts down (doc "Logistic", 17 Oct 2026: เกิน 5 ครั้ง ให้ใส่คำบอก พร้อมนับเวลาถอยหลัง).
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return {
    /** seconds still to wait (0 = may try again) */
    left,
    /** "4:59" */
    label: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`,
    start(seconds: number) {
      if (!(seconds > 0)) return;
      setNow(Date.now());
      setUntil(Date.now() + seconds * 1000);
    },
  };
}

/** Seconds to wait from a 429 response (JSON retryAfter, else the Retry-After header). */
export function retryAfterOf(res: Response, data: { retryAfter?: unknown }): number {
  const n = Number(data?.retryAfter ?? res.headers.get("Retry-After"));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
