"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

// Grouped, searchable dropdown (Figma dev-note "dropdown search"): category headers,
// type-to-filter, scrollable list, and — when allowCustom — type-to-add a value not in the list.
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "เลือกรายการ",
  allowCustom = false,
  disabled = false,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const display = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? value; // custom values show verbatim
  }, [options, value]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
    // group in first-seen order
    const groups: { name: string; items: SelectOption[] }[] = [];
    for (const o of list) {
      const name = o.group ?? "";
      let g = groups.find((x) => x.name === name);
      if (!g) { g = { name, items: [] }; groups.push(g); }
      g.items.push(o);
    }
    return groups;
  }, [options, q]);

  const exact = options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());
  const showAdd = allowCustom && q.trim().length > 0 && !exact;
  const nothing = filtered.length === 0 && !showAdd;

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ("");
  }

  const triggerCls =
    "flex w-full items-center justify-between gap-2 rounded-[8px] border px-[14px] py-[10px] text-[13px] outline-none transition " +
    (invalid ? "border-[#ee443f] " : "border-gray-300 ") +
    (disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : "bg-white text-black hover:border-slate-400");

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} className={triggerCls}>
        <span className={value ? "truncate text-black" : "truncate text-[#bdbdbd]"}>{value ? display : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-2 rounded-[8px] bg-slate-50 px-2.5">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full bg-transparent py-2 text-[13px] text-black outline-none placeholder:text-[#bdbdbd]"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((g) => (
              <div key={g.name || "_"}>
                {g.name ? (
                  <div className="bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-500">{g.name}</div>
                ) : null}
                {g.items.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-blue-50"
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === value ? <Check size={15} className="shrink-0 text-blue-600" /> : null}
                  </button>
                ))}
              </div>
            ))}
            {showAdd ? (
              <button
                type="button"
                onClick={() => pick(q.trim())}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-blue-600 hover:bg-blue-50"
              >
                <PlusMini /> เพิ่ม “{q.trim()}”
              </button>
            ) : null}
            {nothing ? <p className="px-3 py-4 text-center text-[12px] text-slate-400">ไม่พบรายการ</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlusMini() {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-blue-600 text-[12px] leading-none">+</span>
  );
}
