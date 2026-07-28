"use client";

import { Download } from "lucide-react";

// Builds a CSV client-side from already-computed rows and triggers a download.
export default function ExportCsvButton({
  rows,
  filename = "klora-report.csv",
  label = "Export CSV",
}: {
  rows: Record<string, string | number>[];
  filename?: string;
  label?: string;
}) {
  function download() {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <Download size={16} /> {label}
    </button>
  );
}
