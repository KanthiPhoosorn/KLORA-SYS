import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getBatch, getSupplier } from "@/lib/store";
import { thaiDateShort } from "@/lib/format";
import { quantityLabel, categoryLabel, categoryOf, harvestLabel } from "@/lib/produce";
import AutoPrint from "@/components/AutoPrint";

export const dynamic = "force-dynamic";
export const metadata = { title: "พิมพ์ฉลาก QR · KLORA" };

// Stand-alone label sheet (no portal shell, no modals) — opened in a new tab by the logistic
// search screen, prints itself once every QR image has loaded. ?ids=BAT-…,BAT-…
export default async function PrintLabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "logistic" && user.role !== "kyn")) redirect("/logistic/login");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "corta.tech";
  const origin = `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const ids = ((await searchParams).ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  const labels = [];
  for (const id of ids) {
    const b = await getBatch(id);
    const s = b ? await getSupplier(b.supplierId) : null;
    if (b && s) labels.push({ b, s });
  }

  return (
    <div className="print-sheet">
      <style>{`
        @page { size: A4; margin: 10mm; }
        body { background: #fff !important; margin: 0; }
        .print-sheet { font-family: var(--font-noto-thai), var(--font-inter), sans-serif; color: #0f172a; }
        .toolbar { display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        .toolbar button { background: #1262fe; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; padding: 8mm; }
        .label { border: 1.5px solid #000; border-radius: 6px; padding: 5mm; display: grid; grid-template-columns: 1fr 44mm; gap: 4mm; break-inside: avoid; page-break-inside: avoid; min-height: 62mm; }
        .label .brand { font-weight: 800; color: #ff1694; font-size: 14px; letter-spacing: -0.01em; }
        .label .farm { font-weight: 700; font-size: 15px; margin-top: 2px; line-height: 1.3; }
        .label .row { font-size: 11.5px; line-height: 1.5; margin-top: 1px; }
        .label .row b { font-weight: 600; }
        .label .ids { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: #334155; margin-top: 4px; }
        .label .qr { text-align: center; }
        .label .qr img { width: 40mm; height: 40mm; display: block; margin: 0 auto; }
        .label .qr small { display: block; font-size: 8.5px; color: #475569; margin-top: 2px; word-break: break-all; }
        .tag { display: inline-block; font-size: 10px; padding: 1px 6px; border: 1px solid #000; border-radius: 999px; margin-right: 4px; }
        @media print { .toolbar { display: none; } .grid { padding: 0; } }
      `}</style>
      <div className="toolbar">
        <button type="button" id="print-btn">พิมพ์อีกครั้ง</button>
        <span>{labels.length} ฉลาก · หน้าต่างนี้จะเปิดหน้าพิมพ์ให้อัตโนมัติ ปิดแท็บได้เมื่อพิมพ์เสร็จ</span>
      </div>
      {labels.length === 0 ? <p style={{ padding: 24 }}>ไม่พบรายการที่จะพิมพ์</p> : null}
      <div className="grid">
        {labels.map(({ b, s }) => {
          const url = `/api/qr?data=${encodeURIComponent(`${origin}/trace/${b.id}`)}`;
          return (
            <div className="label" key={b.id}>
              <div>
                <div className="brand">KLORA</div>
                <div className="farm">{s.farmName}</div>
                <div className="row"><span className="tag">{categoryLabel(categoryOf(b))}</span>{b.variety || b.productType || s.flowerType}{b.grade ? ` · เกรด ${b.grade}` : ""}</div>
                <div className="row"><b>จำนวน</b> {quantityLabel(b)}</div>
                <div className="row"><b>{harvestLabel(categoryOf(b))}</b> {thaiDateShort(b.cutDate)}</div>
                <div className="row"><b>ปลายทาง</b> {b.destination ?? "—"}{b.branch ? ` · ${b.branch}` : ""}</div>
                {b.destinationAddress ? <div className="row" style={{ fontSize: "10.5px" }}><b>ที่อยู่</b> {b.destinationAddress}</div> : null}
                <div className="row"><b>แหล่งผลิต</b> {s.province ?? "—"}</div>
                <div className="ids">{b.supplierId} · {b.id}</div>
              </div>
              <div className="qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`QR ${b.id}`} />
                <small>สแกนดูแหล่งที่มา · {host}/trace/{b.id}</small>
              </div>
            </div>
          );
        })}
      </div>
      <AutoPrint count={labels.length} />
    </div>
  );
}
