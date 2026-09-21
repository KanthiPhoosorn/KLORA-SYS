"use client";

import { useEffect } from "react";

// Waits for every <img> on the page (the QR codes) to finish loading, then opens the print dialog.
export default function AutoPrint({ count }: { count: number }) {
  useEffect(() => {
    const btn = document.getElementById("print-btn");
    const onClick = () => window.print();
    btn?.addEventListener("click", onClick);
    if (count === 0) return () => btn?.removeEventListener("click", onClick);
    const imgs = Array.from(document.images);
    const waits = imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); })));
    let cancelled = false;
    Promise.all(waits).then(() => { if (!cancelled) setTimeout(() => window.print(), 150); });
    return () => { cancelled = true; btn?.removeEventListener("click", onClick); };
  }, [count]);
  return null;
}
