"use client";

import { useState } from "react";

// A dropdown whose last option is "อื่นๆ (ระบุ)" (Thai Post doc 9 Oct 2026: every dropdown gets one).
// Picking it reveals a text box; the typed text becomes the value, and the server queues it for
// KYN to confirm (src/lib/custom-queue.ts). A value that is not one of `options` opens in "other" mode.
export const OTHER_OPTION = "__other__";

export default function SelectOther({
  value, onChange, options, placeholder, className, inputClassName, otherPlaceholder = "ระบุ", invalid, disabled, numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className: string;
  inputClassName?: string;
  otherPlaceholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** the typed value must be a number (e.g. days) */
  numeric?: boolean;
}) {
  const known = options.some((o) => o.value === value);
  const [other, setOther] = useState(!!value && !known);
  // The parent set a new value from outside (e.g. a picked lot prefills กก.) — follow it instead of keeping
  // the old mode. What the user picks or types here is recorded in `seen` first, so typing "4" on the way
  // to "45" in อื่นๆ mode does not jump back to the list.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (known && other) setOther(false);
    else if (value && !known && !other) setOther(true);
  }
  const emit = (v: string) => { setSeen(v); onChange(v); };
  const bad = invalid ? "border-[#ee443f]" : "";
  return (
    <>
      <select
        value={other ? OTHER_OPTION : value}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === OTHER_OPTION) { setOther(true); emit(""); }
          else { setOther(false); emit(e.target.value); }
        }}
        className={`${className} ${bad}`}
      >
        {placeholder != null ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        <option value={OTHER_OPTION}>อื่นๆ (ระบุ)</option>
      </select>
      {other ? (
        <input
          autoFocus
          type={numeric ? "number" : "text"}
          min={numeric ? 0 : undefined}
          value={value}
          onChange={(e) => emit(e.target.value)}
          placeholder={otherPlaceholder}
          className={`${inputClassName ?? className} mt-2 ${bad}`}
        />
      ) : null}
    </>
  );
}
