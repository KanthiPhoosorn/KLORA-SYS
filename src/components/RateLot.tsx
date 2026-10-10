"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";

// ให้คะแนนความพึงพอใจ on the QR page (Thai Post doc §15): สวน + การขนส่ง, 1–5 stars, optional comment.
// One rating per device per lot — sending again replaces it. Left out of the saved image / PDF.
function Stars({ label, sub, value, onChange }: { label: string; sub?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-slate-800">{label}</p>
        {sub ? <p className="truncate text-[12px] text-slate-500">{sub}</p> : null}
      </div>
      <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`คะแนน${label}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ดาว`} onClick={() => onChange(n)} className="grid size-9 place-items-center rounded-lg active:bg-[#FDECEC]">
            <Star size={26} className={n <= value ? "fill-[#EE2C34] text-[#EE2C34]" : "text-slate-300"} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RateLot({ batchId, farmName, carrierName, mine }: {
  batchId: string; farmName: string; carrierName?: string;
  mine?: { farm?: number; transport?: number; comment?: string } | null;
}) {
  const [farm, setFarm] = useState(mine?.farm ?? 0);
  const [transport, setTransport] = useState(mine?.transport ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(!!mine);
  const [editing, setEditing] = useState(!mine);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, farm: farm || undefined, transport: transport || undefined, comment }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setSent(true); setEditing(false); window.dispatchEvent(new CustomEvent("corta:rated", { detail: d.summary })); }
    else setErr(d.error || "ส่งคะแนนไม่สำเร็จ");
    setBusy(false);
  }

  return (
    <section data-no-capture>
      <h2 className="mb-2 text-[14px] font-semibold text-slate-700">ให้คะแนนความพึงพอใจ</h2>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E7E8]">
        {sent && !editing ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-slate-600">ขอบคุณสำหรับคะแนน — สวน {farm || "–"} ดาว · การขนส่ง {transport || "–"} ดาว</p>
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-[13px] font-medium text-[#193686] underline">แก้คะแนน</button>
          </div>
        ) : (
          <>
            <Stars label="สวน" sub={farmName} value={farm} onChange={setFarm} />
            <Stars label="การขนส่ง" sub={carrierName} value={transport} onChange={setTransport} />
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} rows={2} placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
              className="w-full resize-none rounded-[10px] border border-[#E6E7E8] px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-[#EE2C34]" />
            {err ? <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[12px] text-red-600">{err}</p> : null}
            <button type="button" onClick={send} disabled={busy || (!farm && !transport)} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#EE2C34] px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} ส่งคะแนน
            </button>
            <p className="text-center text-[11px] text-slate-400">คะแนนแสดงเป็นค่าเฉลี่ยของสวนและผู้ขนส่ง · ความคิดเห็นส่งถึงสวนและผู้ขนส่งเท่านั้น</p>
          </>
        )}
      </div>
    </section>
  );
}
