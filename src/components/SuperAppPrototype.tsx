"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Home, Package, Search, User, Leaf, Award, Thermometer, AlertTriangle, ExternalLink, QrCode } from "lucide-react";
import type { TraceSummary } from "@/lib/trace-summary";
import { thaiDateShort } from "@/lib/format";

export interface DemoOrder {
  orderNo: string; date: string; status: string;
  items: { batchId: string; qty: string; price: number; trace: TraceSummary }[];
}

type Screen = { name: "home" } | { name: "fresh" } | { name: "orders" } | { name: "order"; i: number } | { name: "item"; i: number; j: number };

const CAT_TONE: Record<string, string> = { flower: "bg-pink-100 text-pink-700", fruit: "bg-orange-100 text-orange-700", vegetable: "bg-emerald-100 text-emerald-700" };
const CAT_EMOJI: Record<string, string> = { flower: "🌷", fruit: "🥭", vegetable: "🥬" };
const RIPE_TONE: Record<string, string> = { unripe: "bg-lime-100 text-lime-800", turning: "bg-amber-100 text-amber-800", ripe: "bg-emerald-100 text-emerald-800", overripe: "bg-rose-100 text-rose-800" };

// A neutral, unbranded "super app" phone mock. Everything under "รายละเอียดสินค้า" is real KLORA
// data (TraceSummary) — the rest (menu, orders, prices) is illustrative.
export default function SuperAppPrototype({ orders }: { orders: DemoOrder[] }) {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const back = () => {
    if (screen.name === "item") setScreen({ name: "order", i: screen.i });
    else if (screen.name === "order") setScreen({ name: "orders" });
    else if (screen.name === "orders") setScreen({ name: "fresh" });
    else setScreen({ name: "home" });
  };
  const title = screen.name === "home" ? "หน้าหลัก" : screen.name === "fresh" ? "ของสด / ดอกไม้" : screen.name === "orders" ? "My Item · รายการสั่งซื้อ" : screen.name === "order" ? `ออเดอร์ ${orders[screen.i].orderNo}` : "รายละเอียดสินค้า";

  return (
    <div className="w-[402px] shrink-0 overflow-hidden rounded-[36px] border-[10px] border-slate-900 bg-white shadow-2xl">
      {/* status bar */}
      <div className="flex items-center justify-between bg-slate-900 px-6 pb-1 pt-2 text-[11px] text-white"><span>9:41</span><span>●●● 5G</span></div>
      {/* app bar */}
      <div className="flex h-12 items-center gap-2 border-b border-slate-100 px-3">
        {screen.name !== "home" ? <button onClick={back} className="grid size-8 place-items-center rounded-full hover:bg-slate-100"><ChevronLeft size={20} /></button> : <span className="w-8" />}
        <div className="flex-1 truncate text-center text-[15px] font-semibold text-slate-900">{title}</div>
        <span className="w-8" />
      </div>

      <div className="h-[640px] overflow-y-auto bg-slate-50">
        {screen.name === "home" ? (
          <div className="space-y-4 p-4">
            <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 p-4 text-white">
              <div className="text-[12px] opacity-90">สวัสดี คุณลูกค้า</div>
              <div className="text-lg font-bold">วันนี้อยากได้อะไรส่งถึงบ้าน?</div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-[13px] text-slate-400"><Search size={15} /> ค้นหาพัสดุ / สินค้า</div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center text-[11px] text-slate-700">
              {["ส่งพัสดุ", "ติดตามพัสดุ", "จ่ายบิล", "ประกัน", "ช้อปปิ้ง", "ของสด / ดอกไม้", "คูปอง", "ทั้งหมด"].map((m) => (
                <button key={m} onClick={() => m === "ของสด / ดอกไม้" && setScreen({ name: "fresh" })} className={`space-y-1.5 rounded-xl p-2 ${m === "ของสด / ดอกไม้" ? "bg-emerald-50 ring-2 ring-emerald-400" : ""}`}>
                  <div className={`mx-auto grid size-11 place-items-center rounded-2xl text-xl ${m === "ของสด / ดอกไม้" ? "bg-emerald-500 text-white" : "bg-slate-100"}`}>{m === "ของสด / ดอกไม้" ? <Leaf size={20} /> : "▫"}</div>
                  <div className="leading-tight">{m}</div>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-slate-400">แตะ “ของสด / ดอกไม้” เพื่อเริ่ม</p>
          </div>
        ) : null}

        {screen.name === "fresh" ? (
          <div className="space-y-3 p-4">
            <div className="rounded-2xl bg-emerald-600 p-4 text-white">
              <div className="text-lg font-bold">ของสด / ดอกไม้</div>
              <div className="text-[12px] opacity-90">ผลผลิตส่งตรงจากสวน ตรวจสอบย้อนกลับได้ทุกชิ้น</div>
            </div>
            {[{ k: "orders", label: "My Item · รายการสั่งซื้อ", sub: "สินค้าที่คุณเคยสั่ง พร้อมข้อมูลแหล่งที่มา", icon: <Package size={18} />, on: true }, { k: "shop", label: "ตลาดของสด", sub: "เลือกซื้อผัก ผลไม้ ดอกไม้จากสวน", icon: <Leaf size={18} />, on: false }].map((r) => (
              <button key={r.k} disabled={!r.on} onClick={() => setScreen({ name: "orders" })} className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left ${r.on ? "border-emerald-300 ring-2 ring-emerald-200" : "border-slate-200 opacity-60"}`}>
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">{r.icon}</span>
                <span className="flex-1"><span className="block text-[14px] font-semibold text-slate-900">{r.label}</span><span className="block text-[12px] text-slate-500">{r.sub}</span></span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            ))}
          </div>
        ) : null}

        {screen.name === "orders" ? (
          <div className="space-y-3 p-4">
            {orders.map((o, i) => (
              <button key={o.orderNo} onClick={() => setScreen({ name: "order", i })} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
                <div className="flex items-center justify-between text-[12px]"><span className="font-mono text-slate-500">{o.orderNo}</span><span className={`rounded-full px-2 py-0.5 font-medium ${o.status === "จัดส่งสำเร็จ" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{o.status}</span></div>
                <div className="mt-2 flex items-center gap-2">
                  {o.items.map((it) => <span key={it.batchId} className="grid size-9 place-items-center rounded-lg bg-slate-100 text-lg">{CAT_EMOJI[it.trace.product.category]}</span>)}
                  <span className="ml-1 text-[13px] text-slate-700">{o.items.map((it) => it.trace.product.variety || it.trace.product.type).join(" · ")}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-slate-500"><span>{thaiDateShort(o.date)} · {o.items.length} รายการ</span><span className="font-semibold text-slate-800">฿{o.items.reduce((s, it) => s + it.price, 0).toLocaleString()}</span></div>
              </button>
            ))}
          </div>
        ) : null}

        {screen.name === "order" ? (() => {
          const o = orders[screen.i];
          return (
            <div className="space-y-3 p-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[12px] text-slate-500">
                <div className="flex justify-between"><span>เลขที่ออเดอร์</span><span className="font-mono text-slate-800">{o.orderNo}</span></div>
                <div className="mt-1 flex justify-between"><span>วันที่สั่งซื้อ</span><span className="text-slate-800">{thaiDateShort(o.date)}</span></div>
                <div className="mt-1 flex justify-between"><span>สถานะ</span><span className="font-medium text-emerald-700">{o.status}</span></div>
              </div>
              <div className="text-[12px] font-semibold text-slate-500">สินค้าในออเดอร์ — แตะเพื่อดูแหล่งที่มา</div>
              {o.items.map((it, j) => (
                <button key={it.batchId} onClick={() => setScreen({ name: "item", i: screen.i, j })} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left">
                  <span className="grid size-12 place-items-center rounded-xl bg-slate-100 text-2xl">{CAT_EMOJI[it.trace.product.category]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-slate-900">{it.trace.product.variety || it.trace.product.type}</span>
                    <span className="block text-[12px] text-slate-500">{it.trace.origin.farmName} · {it.qty}</span>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><QrCode size={11} /> ตรวจสอบย้อนกลับได้</span>
                  </span>
                  <span className="text-[13px] font-semibold text-slate-800">฿{it.price}</span>
                  <ChevronRight size={18} className="text-slate-300" />
                </button>
              ))}
            </div>
          );
        })() : null}

        {screen.name === "item" ? (() => {
          const it = orders[screen.i].items[screen.j];
          const t = it.trace;
          return (
            <div className="space-y-3 p-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CAT_TONE[t.product.category]}`}>{t.product.categoryLabel}</span>{t.product.grade ? <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white">เกรด {t.product.grade}</span> : null}</div>
                <div className="mt-1.5 text-lg font-bold text-slate-900">{t.product.variety || t.product.type}</div>
                <div className="text-[12px] text-slate-500">{t.product.type} · {it.qty}</div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700"><Leaf size={12} /> ข้อมูลจากระบบ KLORA</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div><div className="text-[11px] text-slate-500">{t.dates.ageLabel}</div><div className="text-xl font-bold text-slate-900">{t.dates.daysSinceHarvest} วัน</div></div>
                  {t.freshness.ripenessLabel ? <div><div className="text-[11px] text-slate-500">ระยะการสุกตอนนี้</div><span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${RIPE_TONE[t.freshness.ripeness!]}`}>{t.freshness.ripenessLabel}</span></div>
                    : <div><div className="text-[11px] text-slate-500">ความสด</div><span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${t.freshness.shelfLifeLeftDays >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{t.freshness.shelfLifeLeftDays >= 0 ? "สดใหม่" : "ควรบริโภคโดยเร็ว"}</span></div>}
                </div>
                <div className="mt-3 space-y-1.5 text-[12.5px] text-slate-700">
                  <div className="flex justify-between"><span className="text-slate-500">แหล่งผลิต</span><span className="font-medium">{t.origin.farmName}{t.origin.province ? ` · ${t.origin.province}` : ""}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t.dates.harvestLabel}</span><span className="font-medium">{thaiDateShort(t.dates.harvestDate)}</span></div>
                  {t.dates.plantingDate ? <div className="flex justify-between"><span className="text-slate-500">วันที่ปลูก</span><span className="font-medium">{thaiDateShort(t.dates.plantingDate)}</span></div> : null}
                  <div className="flex justify-between"><span className="text-slate-500">CO₂e {t.carbon.perUnitLabel}</span><span className="font-medium">{t.carbon.perUnit.toFixed(3)} kg</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">การขนส่ง</span><span className="font-medium">{t.shipment.distanceKm.toLocaleString()} กม.{t.shipment.reefer ? " · ควบคุมอุณหภูมิ" : ""}</span></div>
                  <div className="flex items-center gap-1 text-slate-500"><Thermometer size={12} /> เก็บที่ {t.freshness.storageMinC}–{t.freshness.storageMaxC}°C · เหลืออีก ~{Math.max(0, t.freshness.shelfLifeLeftDays)} วัน</div>
                </div>
                {t.origin.certifications.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">{t.origin.certifications.map((c, k) => <span key={k} className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><Award size={11} /> {c.kind === "other" ? c.name : c.kind}</span>)}</div>
                ) : null}
                {t.freshness.warning ? <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11.5px] text-amber-800"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {t.freshness.warning}</div> : null}
                {t.origin.description ? <p className="mt-3 text-[12px] leading-relaxed text-slate-600">“{t.origin.description}”</p> : null}
              </div>

              <a href={t.links.passport} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-[13px] font-semibold text-white">
                <ExternalLink size={15} /> ดูข้อมูลฉบับเต็ม (หน้าเดียวกับสแกน QR)
              </a>
              <p className="text-center font-mono text-[10px] text-slate-400">GET /api/trace/{t.batchId}</p>
            </div>
          );
        })() : null}
      </div>

      {/* bottom nav */}
      <div className="grid grid-cols-4 border-t border-slate-100 bg-white py-2 text-[10px] text-slate-500">
        {[{ i: <Home size={18} />, l: "หน้าหลัก", s: "home" }, { i: <Package size={18} />, l: "My Item", s: "orders" }, { i: <Search size={18} />, l: "ค้นหา", s: "" }, { i: <User size={18} />, l: "ฉัน", s: "" }].map((n) => (
          <button key={n.l} onClick={() => n.s === "home" ? setScreen({ name: "home" }) : n.s === "orders" ? setScreen({ name: "orders" }) : undefined} className={`flex flex-col items-center gap-0.5 ${(n.s === "home" && screen.name === "home") || (n.s === "orders" && screen.name !== "home" && screen.name !== "fresh") ? "text-emerald-600" : ""}`}>{n.i}{n.l}</button>
        ))}
      </div>
    </div>
  );
}
