"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, MapPin, User, Flower2, Plus, ChevronDown, MoreVertical, Trash2, X } from "lucide-react";
import type { Supplier, FlowerTypeEntry, ProductCategory, Certification } from "@/lib/types";
import { PRODUCTS, PRODUCT_CATEGORIES, CATEGORY_LABEL, variantsFor, categoryOfType } from "@/lib/master-data";
import { type SelectOption } from "@/components/SearchSelect";
import { CertificationsEditor } from "@/components/ProduceGroupsEditor";
import ResourceUsageFields, { resourcePayload, yieldTargets, yieldKey, type ResourceState } from "@/components/ResourceUsageFields";

const OTHER = "__other__";
const CAT_ICON: Record<ProductCategory, string> = { flower: "🌸", fruit: "🍊", vegetable: "🥬" };

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";

// Plain dropdown (Figma #116) — a native select styled like the design, no search box.
function PlainSelect({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void; options: SelectOption[]; placeholder: string;
}) {
  const groups: { name: string; items: SelectOption[] }[] = [];
  for (const o of options) {
    const n = o.group ?? "";
    let g = groups.find((x) => x.name === n);
    if (!g) { g = { name: n, items: [] }; groups.push(g); }
    g.items.push(o);
  }
  const grouped = groups.some((g) => g.name);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] pr-9 text-[13px] text-slate-700 outline-none focus:border-brand-green"
      >
        <option value="">{placeholder}</option>
        {grouped
          ? groups.map((g) => g.name
              ? <optgroup key={g.name} label={g.name}>{g.items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
              : g.items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>))
          : options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

// ชนิดทั้งหมด (ดอกไม้ / ผลไม้ / ผัก) จับกลุ่ม "ประเภท · หมวด" สำหรับ dropdown "เพิ่มรายการผลผลิต"
const TYPE_OPTIONS: SelectOption[] = (() => {
  const seen = new Set<string>();
  const out: SelectOption[] = [];
  for (const cat of PRODUCT_CATEGORIES) {
    for (const p of PRODUCTS) {
      if (p.productCategory !== cat.key || seen.has(p.type)) continue;
      seen.add(p.type);
      out.push({ value: p.type, label: p.type, group: `${cat.label} · ${p.category}` });
    }
  }
  return out;
})();

function useSaver(id: string, onSaved: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      router.refresh();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, save };
}

function SaveBtn({ busy }: { busy: boolean }) {
  return (
    <button type="submit" disabled={busy} className="inline-flex h-[40px] items-center gap-2 rounded-[8px] bg-brand-pink px-8 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60">
      {busy ? <Loader2 size={16} className="animate-spin" /> : null} บันทึกข้อมูล
    </button>
  );
}

// ─── การ์ด accordion ของชนิดดอกไม้หนึ่งชนิด (หัวเขียว + badge จำนวนพันธุ์ + ⋮) ───
function FlowerTypeCard({
  entry,
  open,
  onToggle,
  onRemoveType,
  onAddVariety,
  onEditVariety,
  onRemoveVariety,
}: {
  entry: FlowerTypeEntry;
  open: boolean;
  onToggle: () => void;
  onRemoveType: () => void;
  onAddVariety: (v: string) => void;
  onEditVariety: (i: number, v: string) => void;
  onRemoveVariety: (i: number) => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  const category: ProductCategory = entry.category ?? categoryOfType(entry.type) ?? "flower";
  // พันธุ์ที่ยังไม่ได้เลือกของชนิดนี้ (ตัดที่เลือกแล้วออก) + อื่นๆ ระบุเอง
  const varietyOptions: SelectOption[] = [
    ...variantsFor(category, entry.type).filter((v) => !entry.varieties.includes(v)).map((v) => ({ value: v, label: v })),
    { value: OTHER, label: "อื่นๆ (ระบุเอง)" },
  ];
  const [customVariety, setCustomVariety] = useState<string | null>(null);

  return (
    <div className={`relative overflow-hidden rounded-[12px] border border-brand-green/40 ${menu ? "z-20" : ""}`}>
      {/* หัวการ์ดสีเขียว */}
      <div className="flex items-center gap-3 bg-brand-green px-4 py-3 text-white">
        <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
          <span className="shrink-0 text-[15px] leading-none">{CAT_ICON[category]}</span>
          <span className="text-[14px] font-semibold">{entry.type || "เลือกชนิด"}</span>
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-medium">{CATEGORY_LABEL[category]} · {entry.varieties.length} พันธุ์</span>
          <ChevronDown size={17} className={`ml-auto shrink-0 transition ${open ? "rotate-180" : ""}`} />
        </button>
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} className="grid size-7 place-items-center rounded-md hover:bg-white/20" title="ตัวเลือก">
            <MoreVertical size={16} />
          </button>
          {menu ? (
            <div className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-[10px] border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setMenu(false); onRemoveType(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> ลบรายการนี้
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* เนื้อในการ์ด */}
      {open ? (
        <div className="space-y-3 bg-[#f5fbf6] px-4 py-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
              <Plus size={15} className="text-brand-green" /> เพิ่มพันธุ์{CATEGORY_LABEL[category]}
            </label>
            {customVariety === null ? (
              <PlainSelect
                value=""
                onChange={(v) => { if (v === OTHER) setCustomVariety(""); else if (v.trim()) onAddVariety(v.trim()); }}
                options={varietyOptions}
                placeholder="เลือกพันธุ์"
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={customVariety}
                  onChange={(e) => setCustomVariety(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (customVariety.trim()) onAddVariety(customVariety.trim()); setCustomVariety(null); } }}
                  placeholder="พิมพ์ชื่อพันธุ์"
                  className="w-full rounded-[8px] border border-gray-300 bg-white px-[12px] py-[10px] text-[13px] text-black outline-none focus:border-brand-green"
                />
                <button type="button" onClick={() => { if (customVariety.trim()) onAddVariety(customVariety.trim()); setCustomVariety(null); }} className="shrink-0 rounded-[8px] bg-brand-green px-3 py-[10px] text-[13px] font-medium text-white">เพิ่ม</button>
                <button type="button" onClick={() => setCustomVariety(null)} className="grid size-[40px] shrink-0 place-items-center rounded-[8px] border border-slate-300 text-slate-400 hover:bg-slate-50"><X size={16} /></button>
              </div>
            )}
          </div>
          {entry.varieties.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {entry.varieties.map((v, i) => (
                <div key={i} className="group relative">
                  <input
                    value={v}
                    onChange={(e) => onEditVariety(i, e.target.value)}
                    className="w-full rounded-[8px] border border-gray-300 bg-white px-[12px] py-[10px] pr-9 text-[13px] text-black outline-none focus:border-brand-green"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveVariety(i)}
                    className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                    title="ลบพันธุ์นี้"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400">ยังไม่มีพันธุ์ในชนิดนี้ — เลือกจากรายการด้านบนเพื่อเพิ่ม</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function FarmSettingsForm({ supplier }: { supplier: Supplier }) {
  const [tab, setTab] = useState<"producer" | "resources">("producer");
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };
  const profile = useSaver(supplier.id, () => showToast("ข้อมูลผู้ผลิตของคุณถูกบันทึกแล้ว"));
  const calc = useSaver(supplier.id, () => showToast("ข้อมูลการใช้ทรัพยากรของคุณถูกบันทึกแล้ว"));

  const [p, setP] = useState({
    farmName: supplier.farmName ?? "",
    phone: supplier.phone ?? "",
    address: supplier.address ?? "",
    gps: supplier.gpsLat || supplier.gpsLng ? `${supplier.gpsLat}, ${supplier.gpsLng}` : "",
    highlights: supplier.highlights && supplier.highlights !== "—" ? supplier.highlights : "",
  });
  // seed จากข้อมูลเดิมเสมอ — ถ้าไม่มี flowerTypes ให้แปลงจาก flowerType + varieties เดิม
  // (กันกรณีกดบันทึกแล้วล้างพันธุ์ที่เคยมี)
  const [fts, setFts] = useState<FlowerTypeEntry[]>(
    supplier.flowerTypes?.length
      ? supplier.flowerTypes.map((f) => ({ category: f.category ?? categoryOfType(f.type) ?? "flower", type: f.type, varieties: [...f.varieties] }))
      : supplier.flowerType
        ? [{ category: categoryOfType(supplier.flowerType) ?? "flower", type: supplier.flowerType, varieties: supplier.varieties ? [...supplier.varieties] : [] }]
        : [],
  );
  const [certs, setCerts] = useState<Certification[]>(supplier.certifications ?? []);
  // "อื่นๆ" type: free text + which category it belongs to
  const [customType, setCustomType] = useState<{ name: string; category: ProductCategory } | null>(null);
  const [openType, setOpenType] = useState<string | null>(fts[0]?.type ?? null);
  const [adding, setAdding] = useState(false);

  const [c, setC] = useState<ResourceState>({
    fuelKind: supplier.fuelKind ?? "diesel",
    fuelLitres: supplier.fuelLitres?.toString() ?? "",
    electricityKwh: supplier.electricityKwh?.toString() ?? "",
    fertilizerKind: supplier.fertilizerKind ?? "npk",
    fertilizerKg: supplier.fertilizerKg?.toString() ?? "",
    chemicalKind: supplier.chemicalKind ?? (supplier.agriChemicalsKg ? "insecticide" : "none"),
    agriChemicalsKg: supplier.agriChemicalsKg?.toString() ?? "",
    waterM3: supplier.waterM3?.toString() ?? "",
    wasteKg: supplier.wasteKg?.toString() ?? "",
    yields: Object.fromEntries((supplier.yieldLines ?? []).map((l) => [yieldKey(l), String(l.amount)])),
  });
  const sp = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });

  // ── ตัวช่วยแก้ไข fts ──
  const addType = (type: string, category?: ProductCategory) => {
    if (type === OTHER) { setCustomType({ name: "", category: "fruit" }); return; }
    if (!type || fts.some((f) => f.type === type)) return;
    setFts((prev) => [...prev, { category: category ?? categoryOfType(type) ?? "flower", type, varieties: [] }]);
    setOpenType(type);
    setAdding(false);
    setCustomType(null);
  };
  const removeType = (type: string) => {
    setFts((prev) => prev.filter((f) => f.type !== type));
    setOpenType((o) => (o === type ? null : o));
  };
  const mutVarieties = (type: string, fn: (vs: string[]) => string[]) =>
    setFts((prev) => prev.map((f) => (f.type === type ? { ...f, varieties: fn(f.varieties) } : f)));

  const typeOptionsLeft = [...TYPE_OPTIONS.filter((o) => !fts.some((f) => f.type === o.value)), { value: OTHER, label: "อื่นๆ (ระบุเอง)", group: "อื่นๆ" }];

  const targets = yieldTargets(fts);

  function saveProducer(e: React.FormEvent) {
    e.preventDefault();
    const [la, ln] = p.gps.split(",").map((x) => x.trim());
    // contact: สร้างจากเบอร์โทร + Line ID เดิม (ฟอร์มนี้ไม่ได้โชว์ Line ID) — ไม่ส่งถ้าว่างเพื่อไม่ล้างของเดิม
    const contactParts = [p.phone && `โทร ${p.phone}`, supplier.lineId && `LINE ${supplier.lineId}`].filter(Boolean);
    const cleanFts = fts
      .map((f) => ({ category: f.category, type: f.type.trim(), varieties: f.varieties.map((v) => v.trim()).filter(Boolean) }))
      .filter((f) => f.type);
    profile.save({
      farmName: p.farmName,
      phone: p.phone,
      address: p.address,
      gpsLat: la ? Number(la) : undefined,
      gpsLng: ln ? Number(ln) : undefined,
      highlights: p.highlights,
      flowerTypes: cleanFts,
      certifications: certs,
      ...(contactParts.length ? { contact: contactParts.join(" / ") } : {}),
    });
  }

  function openMap() {
    const q = p.gps.trim() || p.address.trim() || "ประเทศไทย";
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex items-start gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2 size={20} className="mt-0.5 text-emerald-500" />
          <div>
            <p className="text-[13px] font-semibold text-slate-800">บันทึกข้อมูลสำเร็จ</p>
            <p className="text-[12px] text-slate-400">{toast}</p>
          </div>
        </div>
      ) : null}

      {/* Farm hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{supplier.farmName}</h2>
            {supplier.highlights && supplier.highlights !== "—" ? (
              <p className="mt-1 max-w-xl text-[13px] text-slate-500">{supplier.highlights}</p>
            ) : null}
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-slate-500">
              <MapPin size={14} className="text-brand-pink" /> {supplier.address}
            </p>
          </div>
          <div
            className="h-28 w-full shrink-0 rounded-xl bg-cover bg-center sm:w-64"
            style={{ backgroundImage: `url(${supplier.photoUrl || "/figma/greenhouse.webp"})` }}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-t border-slate-100 px-6">
          {[
            { key: "producer", label: "ข้อมูลผู้ผลิต" },
            { key: "resources", label: "ข้อมูลการใช้ทรัพยากร" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`-mb-px border-b-2 py-3 text-[14px] transition ${tab === t.key ? "border-brand-pink font-semibold text-brand-pink" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Producer info */}
      {tab === "producer" ? (
        <form onSubmit={saveProducer} className="space-y-6">
          {/* ข้อมูลพื้นฐาน */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><User size={15} /></span>
              ข้อมูลพื้นฐาน
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>ชื่อผู้ใช้ (แหล่งผลิต)</label><input value={p.farmName} onChange={sp("farmName")} className={inputCls} /></div>
              <div><label className={labelCls}>เบอร์โทรติดต่อ</label><input value={p.phone} onChange={sp("phone")} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>ที่อยู่ฟาร์ม</label><input value={p.address} onChange={sp("address")} className={inputCls} /></div>
            <div>
              <label className={labelCls}>พิกัด GPS <span className="text-brand-pink">*</span></label>
              <div className="flex gap-2">
                <input value={p.gps} onChange={sp("gps")} placeholder="18.7883, 98.9853" className={`${inputCls} flex-1`} />
                <button type="button" onClick={openMap} className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-slate-300 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
                  <MapPin size={14} className="text-brand-pink" /> เลือกจากแผนที่
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>รายละเอียดเพิ่มเติม (จุดเด่นแหล่งผลิต) <span className="text-brand-pink">*</span></label>
              <textarea value={p.highlights} onChange={sp("highlights")} rows={3} className={inputCls} placeholder="เช่น ฟาร์มปลอดสารเคมี ปลูกบนดอยสูง อากาศเย็นตลอดปี" />
            </div>
          </div>

          {/* รายละเอียดดอกไม้และพืชที่ปลูก */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Flower2 size={15} /></span>
                ผลผลิตและพันธุ์ที่ปลูก (ดอกไม้ / ผลไม้ / ผัก)
              </h3>
            </div>

            {fts.length ? (
              <div className="space-y-3">
                {fts.map((entry) => (
                  <FlowerTypeCard
                    key={entry.type}
                    entry={entry}
                    open={openType === entry.type}
                    onToggle={() => setOpenType((o) => (o === entry.type ? null : entry.type))}
                    onRemoveType={() => removeType(entry.type)}
                    onAddVariety={(v) => mutVarieties(entry.type, (vs) => (vs.includes(v) ? vs : [...vs, v]))}
                    onEditVariety={(i, v) => mutVarieties(entry.type, (vs) => vs.map((x, j) => (j === i ? v : x)))}
                    onRemoveVariety={(i) => mutVarieties(entry.type, (vs) => vs.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-[10px] border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-400">
                ยังไม่มีรายการผลผลิต — กดปุ่มด้านล่างเพื่อเพิ่ม
              </p>
            )}

            {/* เพิ่มชนิดดอกไม้ */}
            {adding && customType ? (
              <div className="space-y-2 rounded-[10px] border border-dashed border-slate-300 p-3">
                <div className="flex gap-2">
                  {PRODUCT_CATEGORIES.map((c) => (
                    <button key={c.key} type="button" onClick={() => setCustomType({ ...customType, category: c.key })} className={`flex-1 rounded-[8px] border px-3 py-2 text-[12px] ${customType.category === c.key ? "border-brand-green bg-brand-green font-medium text-white" : "border-gray-300 text-slate-600"}`}>{c.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input autoFocus value={customType.name} onChange={(e) => setCustomType({ ...customType, name: e.target.value })} placeholder="พิมพ์ชื่อชนิด เช่น อะโวคาโด" className={inputCls}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(customType.name.trim(), customType.category); } }} />
                  <button type="button" onClick={() => addType(customType.name.trim(), customType.category)} className="shrink-0 rounded-[8px] bg-brand-green px-4 py-[10px] text-[13px] font-medium text-white">เพิ่ม</button>
                  <button type="button" onClick={() => { setCustomType(null); setAdding(false); }} className="grid size-[40px] shrink-0 place-items-center rounded-[8px] border border-slate-300 text-slate-400 hover:bg-slate-50"><X size={16} /></button>
                </div>
              </div>
            ) : adding ? (
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <PlainSelect
                    value=""
                    onChange={(v) => addType(v)}
                    options={typeOptionsLeft}
                    placeholder="เลือกชนิดที่จะเพิ่ม (ดอกไม้ / ผลไม้ / ผัก)"
                  />
                </div>
                <button type="button" onClick={() => setAdding(false)} className="grid size-[40px] shrink-0 place-items-center rounded-[8px] border border-slate-300 text-slate-400 hover:bg-slate-50">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-2 rounded-[8px] border border-brand-pink px-4 py-2.5 text-[13px] font-medium text-brand-pink hover:bg-brand-pink-light"
              >
                <Plus size={16} /> เพิ่มรายการผลผลิต
              </button>
            )}
          </div>

          {/* ใบรับรองมาตรฐานสินค้าเกษตร */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <CertificationsEditor certs={certs} onChange={setCerts} inputCls={inputCls} accent="green" />
          </div>

          {profile.error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{profile.error}</p> : null}
          <SaveBtn busy={profile.busy} />
        </form>
      ) : (
        /* Resource usage */
        <form
          onSubmit={(e) => { e.preventDefault(); calc.save(resourcePayload(c, targets)); }}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><User size={15} /></span>
            ข้อมูลการใช้ทรัพยากร
          </h3>
          <ResourceUsageFields value={c} onChange={setC} targets={targets} inputCls={inputCls} labelCls={labelCls} />
          <p className="text-[12px] text-slate-400">ตะกร้า (Basket) กรอกในแต่ละรอบส่งออก — ระบบนับการใช้ซ้ำให้เอง · ข้อมูลนี้ใช้คำนวณค่าคาร์บอนเฉพาะของฟาร์มคุณ</p>
          {calc.error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{calc.error}</p> : null}
          <SaveBtn busy={calc.busy} />
        </form>
      )}
    </div>
  );
}
