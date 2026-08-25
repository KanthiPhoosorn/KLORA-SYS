import { Info } from "lucide-react";

// ISO 14067 compliance (KYN spec §4 "กฎเหล็กด้าน UI และความโปร่งใสของข้อมูล").
//
// HARD RULE: never present a carbon figure to a viewer as "Measured CO2e" — the farm-side
// fertilizer/agro-chemical numbers are IPCC Tier-1 reference values, not on-site measurements.
// Always label it "Estimated CO₂e" and show the disclosure text below next to it.

/** The exact wording KYN requires. Keep verbatim. */
export const ISO_14067_NOTE =
  "ตัวเลขนี้เป็นค่าคาร์บอนฟุตพริ้นท์จากการประเมินตามวัฏจักรชีวิตผลิตภัณฑ์ (LCA) โดยอ้างอิงฐานข้อมูลสัมประสิทธิ์มาตรฐาน (Tier-1 Estimate) ตามหลักความโปร่งใสสากล ISO 14067";

/** Label to use wherever a CO₂e figure is shown. */
export const ESTIMATED_LABEL = "Estimated CO₂e";

/** Inline "ประมาณการ" chip — sits beside a headline number. */
export function EstimatedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title={ISO_14067_NOTE}
      className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 ${className}`}
    >
      <Info size={10} /> ประมาณการ (Estimated)
    </span>
  );
}

/** Full footnote block — required on any surface that shows a CO₂e figure. */
export default function Co2eDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400 ${className}`}>
      <Info size={12} className="mt-0.5 shrink-0" />
      <span>{ISO_14067_NOTE}</span>
    </p>
  );
}
