"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, MapPin, User, Flower2, Plus, ChevronDown, MoreVertical, Trash2, X } from "lucide-react";
import type { Supplier, FlowerTypeEntry } from "@/lib/types";
import { FLOWERS, FLOWER_TYPES, variantsForType } from "@/lib/master-data";
import SearchSelect, { type SelectOption } from "@/components/SearchSelect";

const inputCls =
  "w-full rounded-[8px] border border-gray-300 bg-white px-[14px] py-[10px] text-[13px] text-black outline-none placeholder:text-[#bdbdbd] focus:border-brand-pink";
const labelCls = "mb-1.5 block text-[13px] font-medium text-slate-700";

// ชนิดดอกไม้ทั้งหมด จับกลุ่มตามหมวด (ไม้ดอกหลัก / ไม้แซม / ฯลฯ) สำหรับ dropdown "เพิ่มชนิดดอกไม้"
const TYPE_OPTIONS: SelectOption[] = FLOWER_TYPES.map((t) => {
  const f = FLOWERS.find((x) => x.type === t);
  return { value: t, label: t, group: f?.category };
});

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

  // พันธุ์ที่ยังไม่ได้เลือกของชนิดนี้ (ตัดที่เลือกแล้วออก)
  const varietyOptions: SelectOption[] = variantsForType(entry.type)
    .filter((v) => !entry.varieties.includes(v))
    .map((v) => ({ value: v, label: v }));

  return (
    <div className={`relative overflow-hidden rounded-[12px] border border-emerald-200 ${menu ? "z-20" : ""}`}>
      {/* หัวการ์ดสีเขียว */}
      <div className="flex items-center gap-3 bg-emerald-500 px-4 py-3 text-white">
        <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
          <Flower2 size={17} className="shrink-0" />
          <span className="text-[14px] font-semibold">{entry.type || "เลือกชนิดดอกไม้"}</span>
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-medium">{entry.varieties.length} สายพันธุ์</span>
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
                <Trash2 size={14} /> ลบชนิดดอกไม้
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* เนื้อในการ์ด */}
      {open ? (
        <div className="space-y-3 bg-emerald-50/40 px-4 py-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">เพิ่มพันธุ์ดอกไม้</label>
            <SearchSelect
              value=""
              onChange={(v) => { if (v.trim()) onAddVariety(v.trim()); }}
              options={varietyOptions}
              placeholder="เลือกพันธุ์ดอกไม้"
              allowCustom
            />
          </div>
          {entry.varieties.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {entry.varieties.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    value={v}
                    onChange={(e) => onEditVariety(i, e.target.value)}
                    className="w-full rounded-[8px] border border-emerald-200 bg-white px-[12px] py-[9px] text-[13px] text-black outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveVariety(i)}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"
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
      ? supplier.flowerTypes.map((f) => ({ type: f.type, varieties: [...f.varieties] }))
      : supplier.flowerType
        ? [{ type: supplier.flowerType, varieties: supplier.varieties ? [...supplier.varieties] : [] }]
        : [],
  );
  const [openType, setOpenType] = useState<string | null>(fts[0]?.type ?? null);
  const [adding, setAdding] = useState(false);

  const [c, setC] = useState({
    fuelLitres: supplier.fuelLitres?.toString() ?? "",
    electricityKwh: supplier.electricityKwh?.toString() ?? "",
    fertilizerKg: supplier.fertilizerKg?.toString() ?? "",
    agriChemicalsKg: supplier.agriChemicalsKg?.toString() ?? "",
    waterM3: supplier.waterM3?.toString() ?? "",
    wasteKg: supplier.wasteKg?.toString() ?? "",
    flowersPerMonth: supplier.flowersPerMonth?.toString() ?? "",
  });
  const sp = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });
  const sc = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value });

  // ── ตัวช่วยแก้ไข fts ──
  const addType = (type: string) => {
    if (!type || fts.some((f) => f.type === type)) return;
    setFts((prev) => [...prev, { type, varieties: [] }]);
    setOpenType(type);
    setAdding(false);
  };
  const removeType = (type: string) => {
    setFts((prev) => prev.filter((f) => f.type !== type));
    setOpenType((o) => (o === type ? null : o));
  };
  const mutVarieties = (type: string, fn: (vs: string[]) => string[]) =>
    setFts((prev) => prev.map((f) => (f.type === type ? { ...f, varieties: fn(f.varieties) } : f)));

  const typeOptionsLeft = TYPE_OPTIONS.filter((o) => !fts.some((f) => f.type === o.value));

  const RESOURCE_FIELDS: { k: keyof typeof c; label: string }[] = [
    { k: "fuelLitres", label: "ปริมาณเชื้อเพลิง (ลิตร/เดือน)" },
    { k: "electricityKwh", label: "ปริมาณไฟฟ้า (กิโลวัตต์/เดือน)" },
    { k: "fertilizerKg", label: "ปริมาณปุ๋ย (กิโลกรัม/เดือน)" },
    { k: "agriChemicalsKg", label: "ปริมาณสารเคมีทางการเกษตร (กิโลกรัม/เดือน)" },
    { k: "waterM3", label: "ปริมาณน้ำ (ลูกบาศก์เมตร/เดือน)" },
    { k: "wasteKg", label: "ปริมาณของเสีย (กิโลกรัม/เดือน)" },
    { k: "flowersPerMonth", label: "จำนวนดอกไม้ที่ปลูกทั้งหมด (ดอก/เดือน)" },
  ];

  function saveProducer(e: React.FormEvent) {
    e.preventDefault();
    const [la, ln] = p.gps.split(",").map((x) => x.trim());
    // contact: สร้างจากเบอร์โทร + Line ID เดิม (ฟอร์มนี้ไม่ได้โชว์ Line ID) — ไม่ส่งถ้าว่างเพื่อไม่ล้างของเดิม
    const contactParts = [p.phone && `โทร ${p.phone}`, supplier.lineId && `LINE ${supplier.lineId}`].filter(Boolean);
    const cleanFts = fts
      .map((f) => ({ type: f.type.trim(), varieties: f.varieties.map((v) => v.trim()).filter(Boolean) }))
      .filter((f) => f.type);
    profile.save({
      farmName: p.farmName,
      phone: p.phone,
      address: p.address,
      gpsLat: la ? Number(la) : undefined,
      gpsLng: ln ? Number(ln) : undefined,
      highlights: p.highlights,
      flowerTypes: cleanFts,
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
                รายละเอียดดอกไม้และพืชที่ปลูก
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
                ยังไม่มีชนิดดอกไม้ — กดปุ่มด้านล่างเพื่อเพิ่ม
              </p>
            )}

            {/* เพิ่มชนิดดอกไม้ */}
            {adding ? (
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <SearchSelect
                    value=""
                    onChange={addType}
                    options={typeOptionsLeft}
                    placeholder="เลือกชนิดดอกไม้ที่จะเพิ่ม"
                    allowCustom
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
                <Plus size={16} /> เพิ่มชนิดดอกไม้
              </button>
            )}
          </div>

          {profile.error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{profile.error}</p> : null}
          <SaveBtn busy={profile.busy} />
        </form>
      ) : (
        /* Resource usage */
        <form
          onSubmit={(e) => { e.preventDefault(); calc.save(c); }}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><User size={15} /></span>
            ข้อมูลการใช้ทรัพยากร
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {RESOURCE_FIELDS.map((f) => (
              <div key={f.k}>
                <label className={labelCls}>{f.label}</label>
                <input type="number" min="0" step="any" value={c[f.k]} onChange={sc(f.k)} className={inputCls} />
              </div>
            ))}
          </div>
          <p className="text-[12px] text-slate-400">ตะกร้า (Basket) กรอกในแต่ละรอบส่งออก — ระบบนับการใช้ซ้ำให้เอง · ข้อมูลนี้ใช้คำนวณค่าคาร์บอนเฉพาะของฟาร์มคุณ</p>
          {calc.error ? <p className="rounded-[8px] bg-brand-pink-light px-3 py-2 text-[13px] text-[#c1006e]">{calc.error}</p> : null}
          <SaveBtn busy={calc.busy} />
        </form>
      )}
    </div>
  );
}
