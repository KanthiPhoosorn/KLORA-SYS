import { Star, MessageSquare } from "lucide-react";
import type { Rating, RatingSummary } from "@/lib/types";

// ความพึงพอใจของผู้ซื้อ (Thai Post doc §15) — what buyers gave on the QR page, for a back office: the farm
// sees its own, a carrier its own, KYN everything (plus a breakdown by farm and by carrier). Comments are
// shown here only, never on the public QR page.
const sum = (xs: (number | undefined)[]): RatingSummary => { const v = xs.filter((x): x is number => x != null); return { n: v.length, avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }; };
const stars = (n?: number) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
const day = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

function Avg({ label, s }: { label: string; s: RatingSummary }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[20px] font-bold text-slate-800">
        <Star size={18} className={s.n ? "fill-amber-400 text-amber-400" : "text-slate-300"} />{s.n ? s.avg.toFixed(1) : "–"}
        <span className="text-[12px] font-normal text-slate-400">{s.n} คะแนน</span>
      </p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { name: string; s: RatingSummary }[] }) {
  const list = (rs: typeof rows) => (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
      {rs.map((r) => (
        <li key={r.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
          <span className="min-w-0 truncate text-slate-700" title={r.name}>{r.name}</span>
          <span className="flex shrink-0 items-center gap-1 text-slate-600"><Star size={12} className="fill-amber-400 text-amber-400" /><b>{r.s.avg.toFixed(1)}</b><span className="text-slate-400">({r.s.n})</span></span>
        </li>
      ))}
    </ul>
  );
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-slate-500">{title}</p>
      {rows.length ? list(rows.slice(0, 6)) : <p className="text-[12px] text-slate-400">—</p>}
      {/* the rest behind a native toggle — every lot stays reachable */}
      {rows.length > 6 ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[12px] font-medium text-blue-600">ดูทั้งหมด {rows.length} รายการ</summary>
          <div className="mt-1.5">{list(rows.slice(6))}</div>
        </details>
      ) : null}
    </div>
  );
}

export default function RatingsCard({ ratings, show, farmNames }: {
  ratings: Rating[];
  /** whose feedback: the farm's own (สวน), the carrier's own (การขนส่ง), or everything (KYN) */
  show: "farm" | "transport" | "all";
  farmNames?: Record<string, string>;
}) {
  // each side sees only the stars given to it — and the comments that came with them
  const starsOf = (r: Rating) => (show === "farm" ? r.farmStars : show === "transport" ? r.transportStars : r.farmStars ?? r.transportStars);
  const mine = show === "all" ? ratings : ratings.filter((r) => starsOf(r) != null);
  const farm = sum(mine.map((r) => r.farmStars));
  const transport = sum(mine.map((r) => r.transportStars));
  const comments = mine.filter((r) => r.comment).slice(0, 5);
  const group = (key: (r: Rating) => string | undefined, val: (r: Rating) => number | undefined) => {
    const m = new Map<string, (number | undefined)[]>();
    for (const r of mine) { const k = key(r); if (k) m.set(k, [...(m.get(k) ?? []), val(r)]); }
    return [...m].map(([name, xs]) => ({ name, s: sum(xs) })).filter((x) => x.s.n).sort((a, b) => b.s.n - a.s.n);
  };
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-800">ความพึงพอใจของผู้ซื้อ</h2>
        <p className="text-[12px] text-slate-400">คะแนนจากหน้า QR ของสินค้า · ค่าเฉลี่ยแสดงบนหน้า QR ด้วย</p>
      </div>
      {show === "all" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Avg label="คะแนนสวน" s={farm} />
            <Avg label="คะแนนการขนส่ง" s={transport} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown title="รายสวน" rows={group((r) => farmNames?.[r.supplierId] ?? r.supplierId, (r) => r.farmStars)} />
            <Breakdown title="รายผู้ขนส่ง" rows={group((r) => r.carrierName ?? r.carrierKey, (r) => r.transportStars)} />
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Avg label={show === "farm" ? "คะแนนสวนของคุณ" : "คะแนนการขนส่งของคุณ"} s={show === "farm" ? farm : transport} />
          <Breakdown title="รายล็อต" rows={group((r) => r.batchId, starsOf)} />
        </div>
      )}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"><MessageSquare size={13} /> ความคิดเห็นล่าสุด</p>
        {comments.length ? (
          <ul className="space-y-2">
            {comments.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[13px] leading-relaxed text-slate-700">{r.comment}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {show !== "transport" && r.farmStars ? <span className="text-amber-500">สวน {stars(r.farmStars)}</span> : null}
                  {show === "all" && r.farmStars && r.transportStars ? " · " : null}
                  {show !== "farm" && r.transportStars ? <span className="text-amber-500">ขนส่ง {stars(r.transportStars)}</span> : null}
                  {" · "}{r.batchId} · {day(r.updatedAt)}{show === "all" && farmNames ? ` · ${farmNames[r.supplierId] ?? ""}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="text-[12px] text-slate-400">{mine.length ? "ยังไม่มีความคิดเห็น" : "ยังไม่มีคะแนนจากผู้ซื้อ"}</p>}
      </div>
    </div>
  );
}
