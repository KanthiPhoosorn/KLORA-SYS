import { Check } from "lucide-react";

export interface StepItem {
  label: string;
  img: string; // /figma/step-*.webp
  date: string; // date text, or a status like "กำลังดำเนินการ"
  done?: boolean;
  inProgress?: boolean;
}

// Figma "สถานะการจัดส่งล่าสุด": a progress track (checkmark / current / pending nodes)
// above illustrated step icons with labels + dates.
export default function ShipmentStepper({ steps }: { steps: StepItem[] }) {
  return (
    <div>
      {/* progress track */}
      <div className="flex items-center">
        {steps.map((s, i) => {
          const reached = s.done || s.inProgress;
          return (
            <div key={s.label} className="flex flex-1 items-center">
              <div className={`h-1 flex-1 rounded ${i === 0 ? "opacity-0" : reached ? "bg-emerald-500" : "bg-slate-200"}`} />
              <div
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  s.done ? "bg-emerald-500 text-white" : s.inProgress ? "border-[3px] border-emerald-500 bg-white" : "bg-slate-200"
                }`}
              >
                {s.done ? <Check size={18} /> : s.inProgress ? <span className="size-2.5 rounded-full bg-emerald-500" /> : null}
              </div>
              <div className={`h-1 flex-1 rounded ${i === steps.length - 1 ? "opacity-0" : steps[i + 1].done || steps[i + 1].inProgress ? "bg-emerald-500" : "bg-slate-200"}`} />
            </div>
          );
        })}
      </div>

      {/* illustrated icons + labels */}
      <div className="mt-4 flex">
        {steps.map((s) => {
          const on = s.done || s.inProgress;
          return (
            <div key={s.label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.img} alt="" className={`size-16 ${on ? "" : "opacity-40 grayscale"}`} />
              <div className={`text-sm font-semibold ${on ? "text-slate-700" : "text-slate-400"}`}>{s.label}</div>
              <div className={`whitespace-pre-line text-xs ${s.inProgress ? "text-emerald-600" : "text-slate-400"}`}>{s.date}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
