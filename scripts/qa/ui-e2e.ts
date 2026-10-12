// UI end-to-end on localhost (Thai Post doc 9 Oct 2026 §2, §4, §5, §8). Drives the farm's round form in a
// real browser — packaging rows from the KYN catalog (per-product lists, ไม่มีบรรจุภัณฑ์, ไม่ทราบขนาด,
// กำหนดเอง in inches, อื่นๆ, reusable registration, several inner materials), packed weight in grams,
// recipient-address distance — then the manage menu through every state: edit with the old → new
// review, carrier print, tracking number, carrier print-cancel + bell, cancel with a reason, and the
// form at phone width. The QA farm and everything it creates are removed at the end.
//   npx tsx --env-file=.env.local scripts/qa/ui-e2e.ts      (dev server on :3123; SHOT_DIR for screenshots)
import puppeteer from "puppeteer-core";
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PNG } from "pngjs";

const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-ui-${TS}@klora-qa.test`;
const SHOTS = process.env.SHOT_DIR;
const LONG_ADDR = "321/12 หมู่ 5 ถนนเชียงใหม่-ลำพูน ตำบลช้างคลาน อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50100 อาคารพาณิชย์สามชั้นสีครีม ชั้น 3 ห้อง 302 ตรงข้ามตลาดไนท์บาซาร์ ใกล้ร้านดอกไม้ศรีสุข (โทรก่อนส่ง)";
const OTHER_NAME = `ตะกร้าหวาย QA ${TS}`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const has = (a: string[], want: string[]) => want.every((w) => a.includes(w));
async function tapOn(pg: import("puppeteer-core").Page, el: string, mouse = false): Promise<boolean> {
  const r = (await pg.evaluate(`(() => { const e = ${el}; if (!e) return null; const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, top: !!hit && e.contains(hit) }; })()`)) as { x: number; y: number; top: boolean } | null;
  if (!r) return false;
  if (mouse) await pg.mouse.click(r.x, r.y); else await pg.touchscreen.tap(r.x, r.y);
  return r.top;
}
const lacks = (a: string[], bad: string[]) => !bad.some((w) => a.includes(w));

// Page-side driver. Fields are found by their visible label (or aria-label), the way a person reads the form.
const DRIVER = `
window.__name = (f) => f;
window.qa = {
  lab(el) {
    const a = el.getAttribute("aria-label"); if (a) return a;
    for (let p = el.parentElement, d = 0; p && d < 4; p = p.parentElement, d++) {
      const l = Array.from(p.children).find((c) => c.tagName === "LABEL");
      if (l) return (l.textContent || "").replace(/\\s+/g, " ").replace(/\\s*\\*\\s*$/, "").trim();
    }
    return "";
  },
  all(root, tag, label, exact) { return Array.from((root || document).querySelectorAll(tag)).filter((e) => exact ? qa.lab(e) === label : qa.lab(e).startsWith(label)); },
  find(root, tag, label, nth, exact) { return qa.all(root, tag, label, exact)[nth || 0] || null; },
  set(el, v) {
    if (!el) throw new Error("no field");
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(v));
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    return el.value;
  },
  sel(root, label, v, nth) { return qa.set(qa.find(root, "select", label, nth), v); },
  inp(root, label, v, nth, exact) { return qa.set(qa.find(root, "input", label, nth, exact), v); },
  date(root, label, v) { return qa.set(qa.find(root, "input", label).parentElement.querySelector('input[type="date"]'), v); },
  btns(text, root) { return Array.from((root || document).querySelectorAll("button")).filter((b) => (b.textContent || "").replace(/\\s+/g, " ").trim().includes(text)); },
  click(text, root, last) { const b = qa.btns(text, root); const x = last ? b[b.length - 1] : b[0]; if (!x) throw new Error("no button " + text); x.click(); return true; },
  cat(name) { const l = Array.from(document.querySelectorAll("label")).find((x) => (x.textContent || "").trim() === name); if (!l) throw new Error("no category " + name); l.click(); return true; },
  rows() { return qa.all(document, "select", "บรรจุภัณฑ์").map((s) => { let p = s.parentElement; while (p && !qa.all(p, "select", "ชนิดวัสดุ").length) p = p.parentElement; return p; }); },
  row(i) { return qa.rows()[i]; },
  opts(el) { return el ? Array.from(el.options).map((o) => o.value) : []; },
  text(el) { return ((el || document.body).innerText || "").replace(/\\s+/g, " ").trim(); },
  tr(id) { return Array.from(document.querySelectorAll("tbody tr")).find((t) => t.innerText.includes(id)) || null; },
  menu(id) {
    const tr = qa.tr(id); if (!tr) return null;
    tr.querySelector('button[aria-label^="จัดการรายการ"]').click();
    return true;
  },
  menuItems() { return Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"]')).map((b) => ({ name: (b.children[0]?.textContent || "").trim(), off: b.disabled, why: (b.children[1]?.textContent || "").trim() })); },
};`;

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const lg = mint("USR-0002");
  let supId = ""; let lot = ""; let code = "";
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    // ---- fixture: a farm with flowers and fruit -------------------------------------------------
    const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      farmName: `QA UI Farm ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "กุหลาบ",
      flowerTypes: [{ category: "flower", type: "กุหลาบ", varieties: ["แดง"] }, { category: "fruit", type: "มะม่วง", varieties: ["น้ำดอกไม้สีทอง"] }],
      email: EMAIL, username: "qa_ui_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" }) });
    const cookie = /klora_session=([^;]+)/.exec(reg.headers.get("set-cookie") || "")?.[1];
    supId = (await reg.json()).supplier?.id ?? "";
    log("fixture farm registered", reg.status === 201 && !!cookie && !!supId, `${reg.status} ${supId}`);
    if (!cookie) throw new Error("no fixture");

    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
    const errs: string[] = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    await p.evaluateOnNewDocument(DRIVER);
    await b.setCookie({ name: "klora_session", value: cookie, domain: "localhost", path: "/" });
    const ev = <T = unknown>(js: string) => p.evaluate(js) as Promise<T>;
    const act = async (js: string, ms = 250) => { await ev(js); await sleep(ms); };
    const waitFor = (js: string, ms = 15000) => p.waitForFunction(js, { timeout: ms, polling: 200 }).then(() => true, () => false);
    // full-page shots resize the viewport, which closes the floating manage menu — menus use full = false
    const shot = async (name: string, full = true) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/e2e-${name}.png`, fullPage: full }); };

    // ---- §4.7 lists follow the product type --------------------------------------------------------
    await p.goto(BASE + "/app/new", { waitUntil: "networkidle0" });
    const lists = async () => ev<{ packs: string[]; inner: string[] }>(`({ packs: qa.opts(qa.find(qa.row(0), "select", "บรรจุภัณฑ์")), inner: qa.opts(qa.find(qa.row(0), "select", "ชนิดวัสดุ")) })`);
    await act(`qa.cat("ดอกไม้")`, 400);
    const fl = await lists();
    log("4.7 flowers: long flower box + water bucket, no bulk / crate / foam / bag", has(fl.packs, ["carton", "flowerbox", "basket", "bucket", "pallet", "other"]) && lacks(fl.packs, ["nopack", "crate", "foam", "plasticbag"]), fl.packs.join(","));
    log("4.7 flowers' inner materials: sleeve / tube / floral foam, no fruit net / pulp tray / ice", has(fl.inner, ["none", "sleeve", "tube", "floralfoam", "other"]) && lacks(fl.inner, ["epe", "pulp", "ice"]), fl.inner.join(","));
    await act(`qa.cat("ผลไม้")`, 400);
    const fr = await lists();
    log("4.7 fruit: bulk + crate / foam / wood / bamboo / mesh, no flower box / bucket", has(fr.packs, ["nopack", "crate", "foam", "wood", "bamboo", "mesh", "other"]) && lacks(fr.packs, ["flowerbox", "bucket", "plasticbag"]), fr.packs.join(","));
    log("4.7 fruit's inner materials: foam net / pulp tray / ice, no sleeve / tube", has(fr.inner, ["epe", "pulp", "ice"]) && lacks(fr.inner, ["sleeve", "tube", "floralfoam"]), fr.inner.join(","));
    await act(`qa.sel(qa.row(0), "บรรจุภัณฑ์", "nopack")`);
    const bulk = await ev<Record<string, unknown>>(`(() => { const r = qa.row(0), s = (l) => qa.find(r, "select", l); return {
      usage: s("การใช้งาน").disabled && s("การใช้งาน").selectedOptions[0].text, code: s("หมายเลขบรรจุภัณฑ์").disabled && s("หมายเลขบรรจุภัณฑ์").selectedOptions[0].text,
      size: s("ขนาด").disabled && s("ขนาด").selectedOptions[0].text, qty: qa.find(r, "input", "จำนวน").disabled, inner: s("ชนิดวัสดุ").disabled }; })()`);
    log("4.2 ไม่มีบรรจุภัณฑ์ (เทกอง): every field ไม่มี and greyed", bulk.usage === "ไม่มี" && String(bulk.code).startsWith("ไม่มี") && bulk.size === "ไม่มี" && bulk.qty === true && bulk.inner === true, JSON.stringify(bulk));

    // ---- a flower round through the form -----------------------------------------------------------
    await act(`qa.cat("ดอกไม้")`, 400);
    await act(`qa.inp(document, "ชนิด", "กุหลาบ", 0, true)`);
    await act(`qa.inp(document, "พันธุ์", "แดง", 0, true)`);
    await act(`qa.click("A+ พรีเมียม")`); // เกรดสินค้า (13 Oct 2026)
    await act(`qa.inp(document, "จำนวนดอกไม้", "500")`);
    await act(`qa.date(document, "วันที่ตัด", "2026-10-08")`);
    log("§S1 label reads อายุหลังตัดที่คาดการณ์ (วัน)", await ev(`!!qa.find(document, "select", "อายุหลังตัดที่คาดการณ์ (วัน)", 0, true)`));
    await act(`qa.sel(document, "อายุหลังตัดที่คาดการณ์", "__other__")`, 250);
    await p.keyboard.type("45", { delay: 60 }); await sleep(200);
    const typed = await ev<{ sel: string; v: string | null }>(`(() => { const s = qa.find(document, "select", "อายุหลังตัดที่คาดการณ์"); const i = s.parentElement.querySelector('input[type="number"]'); return { sel: s.value, v: i ? i.value : null }; })()`);
    log("อื่นๆ (ระบุ): typing 45 stays in the box (does not jump to the listed 4)", typed.sel === "__other__" && typed.v === "45", JSON.stringify(typed));
    await act(`qa.sel(document, "อายุหลังตัดที่คาดการณ์", "14")`);

    // row 1 — single-use carton, size unknown, two inner materials (one removed again)
    await act(`qa.sel(qa.row(0), "บรรจุภัณฑ์", "carton")`);
    const r0 = await ev<Record<string, unknown>>(`(() => { const r = qa.row(0), c = qa.find(r, "select", "หมายเลขบรรจุภัณฑ์"); return { usage: qa.find(r, "select", "การใช้งาน").value, unit: qa.find(r, "select", "หน่วยจำนวน").value, size: qa.find(r, "select", "ขนาด").value, codeText: c.selectedOptions[0].text, codeOff: c.disabled, codeBg: getComputedStyle(c).backgroundColor }; })()`);
    log("4.3 carton presets: ใช้ครั้งเดียว · ใบ · a size", r0.usage === "single" && r0.unit === "ใบ" && !!r0.size, JSON.stringify(r0));
    log("4.2 single-use code shows ‘ไม่มี · ใช้ครั้งเดียว’, greyed", r0.codeText === "ไม่มี · ใช้ครั้งเดียว" && r0.codeOff === true && r0.codeBg !== "rgb(255, 255, 255)", `${r0.codeText} ${r0.codeBg}`);
    const inner0 = await ev<Record<string, unknown>>(`(() => { const r = qa.row(0); return { kind: qa.find(r, "select", "ชนิดวัสดุ").value, qtyOff: qa.all(r, "input", "จำนวน")[1]?.disabled, unitOff: qa.find(r, "select", "หน่วยวัสดุ").disabled }; })()`);
    log("4.2 inner material defaults to ไม่มีวัสดุภายใน, qty + unit greyed", inner0.kind === "none" && inner0.qtyOff === true && inner0.unitOff === true, JSON.stringify(inner0));
    await act(`qa.sel(qa.row(0), "ขนาด", "unknown")`);
    log("4.2 ไม่ทราบขนาด → ‘ค่าประมาณ’ tag", await ev(`qa.text(qa.row(0)).includes("ค่าประมาณ")`));
    await act(`qa.inp(qa.row(0), "จำนวน", "10")`);
    await act(`qa.sel(qa.row(0), "ชนิดวัสดุ", "sleeve")`);
    log("4.5 inner unit follows the material (sleeve → ใบ)", (await ev(`qa.find(qa.row(0), "select", "หน่วยวัสดุ").value`)) === "ใบ");
    await act(`qa.inp(qa.row(0), "จำนวน", "10", 1)`);
    await act(`qa.click("เพิ่มวัสดุภายใน", qa.row(0))`);
    await act(`qa.sel(qa.row(0), "ชนิดวัสดุ", "tube", 1)`);
    const nIn = await ev<number>(`qa.all(qa.row(0), "select", "ชนิดวัสดุ").length`);
    await act(`qa.click("ลบ", Array.from(qa.row(0).querySelectorAll("button")).filter((x) => !x.textContent.includes("บรรจุภัณฑ์") && x.textContent.includes("ลบ"))[1]?.parentElement)`);
    const nIn2 = await ev<number>(`qa.all(qa.row(0), "select", "ชนิดวัสดุ").length`);
    log("4.1 inner materials: add a second, remove it again", nIn === 2 && nIn2 === 1, `${nIn} → ${nIn2}`);

    // row 2 — reusable basket, registered on the spot
    await act(`qa.click("เพิ่มบรรจุภัณฑ์")`, 400);
    await act(`qa.sel(qa.row(1), "บรรจุภัณฑ์", "basket")`);
    const r1 = await ev<Record<string, string>>(`(() => { const r = qa.row(1); return { usage: qa.find(r, "select", "การใช้งาน").value, unit: qa.find(r, "select", "หน่วยจำนวน").value, size: qa.find(r, "select", "ขนาด").value }; })()`);
    log("4.3 ตะกร้าพลาสติก → หมุนเวียน · ใบ · M", r1.usage === "reusable" && r1.unit === "ใบ" && r1.size === "M", JSON.stringify(r1));
    await act(`qa.sel(qa.row(1), "หมายเลขบรรจุภัณฑ์", "new")`);
    log("4.4 + ลงทะเบียนใหม่ asks for past trips + ‘ลงทะเบียนและใช้งาน’", await ev(`!!qa.find(qa.row(1), "input", "ลงทะเบียนใหม่") && qa.btns("ลงทะเบียนและใช้งาน", qa.row(1)).length === 1`));
    await act(`qa.inp(qa.row(1), "ลงทะเบียนใหม่", "5")`);
    await act(`qa.click("ลงทะเบียนและใช้งาน", qa.row(1))`);
    await waitFor(`/^PKG-/.test(qa.find(qa.row(1), "select", "หมายเลขบรรจุภัณฑ์")?.value || "")`, 10000);
    const regd = await ev<Record<string, string>>(`(() => { const s = qa.find(qa.row(1), "select", "หมายเลขบรรจุภัณฑ์"); return { code: s.value, opt: s.selectedOptions[0].text, msg: (qa.text(qa.row(1)).match(/ลงทะเบียนแล้ว[^\\n]{0,40}/) || [""])[0] }; })()`);
    code = regd.code;
    log("4.4 new PKG code made, picked at once, confirmed", /^PKG-\d{4}$/.test(code) && regd.msg.includes(code), `${code} | ${regd.msg}`);
    log("4.4 the code list shows trips used", /ใช้แล้ว 5 รอบ/.test(regd.opt), regd.opt);
    await act(`qa.inp(qa.row(1), "จำนวน", "2")`);

    // row 3 — อื่นๆ (ระบุ): own name + material + weighed weight, custom size in inches
    await act(`qa.click("เพิ่มบรรจุภัณฑ์")`, 400);
    await act(`qa.sel(qa.row(2), "บรรจุภัณฑ์", "other")`);
    const o = await ev<Record<string, unknown>>(`(() => { const r = qa.row(2); return { name: !!qa.find(r, "input", "ชื่อบรรจุภัณฑ์"), mats: qa.opts(qa.find(r, "select", "ทำจากอะไร")), w: qa.opts(qa.find(r, "select", "น้ำหนักต่อหน่วย")) }; })()`);
    log("4.6 อื่นๆ asks name, material (9) and weight class (+ ชั่งเอง / ไม่ทราบ)", o.name === true && (o.mats as string[]).length >= 9 && has(o.w as string[], ["xlight", "light", "mid", "heavy", "weighed", "unknown"]), JSON.stringify(o));
    await act(`qa.inp(qa.row(2), "ชื่อบรรจุภัณฑ์", ${JSON.stringify(OTHER_NAME)})`);
    await act(`qa.sel(qa.row(2), "ทำจากอะไร", "bamboo")`);
    await act(`qa.sel(qa.row(2), "น้ำหนักต่อหน่วย", "weighed")`);
    await act(`qa.inp(qa.row(2), "น้ำหนักที่ชั่งได้", "250")`);
    await act(`qa.sel(qa.row(2), "หน่วยน้ำหนัก", "กรัม")`);
    await act(`qa.sel(qa.row(2), "ขนาด", "custom")`);
    await act(`qa.inp(qa.row(2), "กว้าง", "10")`); await act(`qa.inp(qa.row(2), "ยาว", "12")`); await act(`qa.inp(qa.row(2), "สูง", "8")`);
    await act(`qa.sel(qa.row(2), "หน่วย", "in")`);
    await act(`qa.inp(qa.row(2), "จำนวน", "1")`);
    log("4.6 the อื่นๆ row is tagged ค่าประมาณ", await ev(`qa.text(qa.row(2)).includes("ค่าประมาณ")`));

    // รูปถ่ายตอนแพ็ก (12 Oct 2026): the camera button takes a picture → stamped, shrunk, uploaded
    const cam = await p.$('input[type="file"][capture="environment"]');
    await (cam as unknown as { uploadFile: (f: string) => Promise<void> }).uploadFile("public/figma/step-qr.webp");
    const shot1 = await waitFor(`document.querySelectorAll('img[alt="รูปถ่ายตอนแพ็ก"]').length === 1`, 20000);
    log("packing photo: taken, uploaded, shown with its time badge", shot1 && (await ev<boolean>(`/ยืนยันเวลา|ไม่ยืนยันเวลา/.test(document.body.innerText)`)));
    // packed weight in grams (§4.8)
    await act(`qa.inp(document, "น้ำหนักรวมหลังแพ็ก", "30000")`);
    await act(`qa.sel(document, "หน่วยน้ำหนักรวม", "กรัม")`);

    // shipping: province, recipient address → distance from the origin branch (§S2)
    await act(`qa.date(document, "วันที่จัดส่ง", "2026-10-09")`);
    log("§S2 labels: จังหวัดปลายทาง + สาขาต้นทาง", await ev(`!!qa.find(document, "select", "จังหวัดปลายทาง", 0, true) && !!qa.find(document, "select", "สาขาต้นทาง", 0, true)`));
    await act(`qa.sel(document, "จังหวัดปลายทาง", "เชียงใหม่")`);
    await act(`qa.inp(document, "รหัสไปรษณีย์", "50100")`);
    await act(`(() => { const s = qa.find(document, "select", "สาขาต้นทาง"); return qa.set(s, Array.from(s.options).map((x) => x.value).find((v) => v && v !== "__other__")); })()`);
    await sleep(900);
    const beforeAddr = await ev<{ km: string; hint: boolean }>(`({ km: qa.find(document, "input", "ระยะทางขนส่ง")?.value, hint: document.body.innerText.includes("กรอกที่อยู่ผู้รับ ระบบจะคำนวณระยะทาง") })`);
    log("§S2 no distance from the province alone — it asks for the recipient address", beforeAddr.km === "" && beforeAddr.hint, JSON.stringify(beforeAddr));
    await act(`qa.inp(document, "ที่อยู่ปลายทาง", ${JSON.stringify(LONG_ADDR)})`, 400);
    const gotKm = await waitFor(`Number(qa.find(document, "input", "ระยะทางขนส่ง")?.value) > 0`, 25000);
    const km = await ev<string>(`qa.find(document, "input", "ระยะทางขนส่ง")?.value`);
    log("§S2 distance filled from recipient address − origin branch", gotKm, `${km} km`);
    await shot("form");

    // next → review → save
    const nextLabel = await ev<string>(`qa.btns("ถัดไป").length ? "ถัดไป" : "บันทึก"`);
    log("§5.4 the form's button says ถัดไป (it opens the review)", nextLabel === "ถัดไป", nextLabel);
    await act(`qa.click(${JSON.stringify(nextLabel)}, null, true)`, 500);
    const onReview = await waitFor(`document.body.innerText.includes("ตรวจสอบและยืนยันข้อมูล")`, 8000);
    if (!onReview) console.log("      form errors:", await ev(`Array.from(document.querySelectorAll("p")).filter((x) => /text-\\[#ee443f\\]|text-red/.test(x.className)).map((x) => x.textContent).join(" | ")`));
    const rv = await ev<string>(`qa.text()`);
    log("review shows age, province, branch, packed weight 30 กก.", onReview && ["อายุหลังตัดที่คาดการณ์", "จังหวัดปลายทาง", "สาขาต้นทาง", "น้ำหนักรวมหลังแพ็ก"].every((t) => rv.includes(t)) && /30 กก\./.test(rv), onReview ? "" : "no review");
    await shot("review");
    await act(`qa.click("บันทึก", null, true)`, 400);
    await act(`qa.click("ยืนยัน", document.querySelector('[role="dialog"]') || document, true)`);
    await waitFor(`location.pathname === "/app/history"`, 20000);
    lot = (await sql`SELECT id FROM batches WHERE supplier_id = ${supId}`)[0]?.id ?? "";
    log("saved as LOT-YYMM-NNNN", /^LOT-\d{4}-\d{4}$/.test(lot), lot);
    const [row] = lot ? await sql`SELECT expected_age_days, shipped_weight_kg, distance_km, packaging_items, destination, status FROM batches WHERE id = ${lot}` : [];
    log("saved: age 14 · packed 30 kg (from grams) · 3 packaging rows · computed", row?.expected_age_days === 14 && Number(row?.shipped_weight_kg) === 30 && (row?.packaging_items as unknown[])?.length === 3 && row?.status === "computed", JSON.stringify({ age: row?.expected_age_days, kg: row?.shipped_weight_kg, rows: (row?.packaging_items as unknown[])?.length, st: row?.status }));
    log("packing photo saved on the lot", (await sql`SELECT count(*)::int n FROM pack_photos WHERE batch_id = ${lot}`)[0].n === 1);
    log("grade A+ saved", (await sql`SELECT grade FROM batches WHERE id = ${lot}`)[0]?.grade === "A+");
    const [ce] = await sql`SELECT field FROM custom_entries WHERE value = ${OTHER_NAME}`;
    log("4.6 the อื่นๆ packaging went to KYN's review queue", !!ce, ce?.field);
    if (!lot) throw new Error("no lot");

    // ---- §14 passport (public, phone): long farm story → ดูเพิ่มเติม pop-up; save button top-right ----
    const STORY = "สวนกุหลาบบนดอยแม่ริมของเราปลูกแบบลดสารเคมีมาตั้งแต่ปี 2558 ใช้ปุ๋ยหมักจากเศษกิ่งและใบที่ตัดแต่งในสวน เก็บน้ำฝนไว้ใช้ตลอดหน้าแล้ง ตัดดอกตอนเช้ามืดแล้วแช่น้ำเย็นทันทีเพื่อให้ดอกสดนาน ทุกช่อผ่านการคัดด้วยมือก่อนแพ็กลงกล่อง ปิดท้ายเรื่องราวของฟาร์ม QA";
    await sql`UPDATE suppliers SET description = ${STORY} WHERE id = ${supId}`;
    {
      const ctx = await b.createBrowserContext();
      const tp = await ctx.newPage(); await tp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      tp.on("pageerror", (e) => errs.push("passport: " + String(e).slice(0, 160)));
      await tp.goto(BASE + "/t/" + lot, { waitUntil: "networkidle0" });
      const btn = (await tp.evaluate(`(() => { const bt = document.querySelector('button[aria-haspopup="dialog"][aria-label^="จุดเด่นของ"]'); if (bt) bt.click(); return !!bt; })()`)) as boolean;
      await sleep(300);
      const pop = (await tp.evaluate(`(() => { const d = document.querySelector('[role="dialog"]'); return { open: !!d, full: !!d && d.innerText.includes("ปิดท้ายเรื่องราวของฟาร์ม QA") }; })()`)) as { open: boolean; full: boolean };
      const save = (await tp.evaluate(`(() => { const x = Array.from(document.querySelectorAll("button, a")).find((e) => /บันทึก/.test((e.getAttribute("aria-label") || "") + (e.textContent || ""))); if (!x) return null; const r = x.getBoundingClientRect(); return { fromRight: Math.round(innerWidth - r.right), top: Math.round(r.top) }; })()`)) as { fromRight: number; top: number } | null;
      log("§15 tapping the farm card opens the farm's จุดเด่น", btn && pop.open && pop.full, JSON.stringify({ btn, ...pop }));
      const gap = (await tp.evaluate(`(() => { const d = document.querySelector('[role="dialog"]'); return Math.round(innerHeight - d.parentElement.getBoundingClientRect().bottom); })()`)) as number;
      log("§15 the farm sheet covers the screen to the bottom edge", gap === 0, `gap ${gap}px`);
      await tp.keyboard.press("Escape"); await sleep(200);
      log("§14 save as image / PDF sits top-right", !!save && save.fromRight < 80 && save.top < 140, JSON.stringify(save));
      log("QR hero shows เกรด A+", (await tp.evaluate(`document.body.innerText.includes("เกรด A+")`)) as boolean);
      const openSave = async (pg: typeof tp) => {
        await tapOn(pg, `document.querySelector('button[aria-label="บันทึกหน้านี้"]')`); await sleep(300);
        const onTop = await tapOn(pg, `Array.from(document.querySelectorAll('[role="menuitem"]')).find((x) => x.textContent.includes("รูปภาพ"))`);
        if (!onTop) return false;
        return pg.waitForFunction(`!!Array.from(document.querySelectorAll('[role="dialog"]')).find((d) => d.innerText.includes("บันทึก / แชร์"))`, { timeout: 25000 }).then(() => true, () => false);
      };
      const sheet = await openSave(tp);
      log("phone: a real tap reaches the save menu (not hidden under the page)", sheet);
      const pv = (await tp.evaluate(`(() => { const d = Array.from(document.querySelectorAll('[role="dialog"]')).find((x) => x.innerText.includes("บันทึก / แชร์")); const im = d && d.querySelector("img"); return { img: !!im && im.naturalWidth > 300, hint: !!d && d.innerText.includes("กดค้างที่รูป") }; })()`)) as { img: boolean; hint: boolean };
      log("phone: save → the image is made, then a sheet: บันทึก / แชร์ + long-press preview", sheet && pv.img && pv.hint, JSON.stringify(pv));
      const lineCtx = await b.createBrowserContext();
      const lp = await lineCtx.newPage(); await lp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await lp.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0");
      await lp.evaluateOnNewDocument(DRIVER);
      await lp.goto(BASE + "/t/" + lot, { waitUntil: "networkidle0" });
      const lineSheet = await openSave(lp);
      const ext = (await lp.evaluate(`(() => { const a = Array.from(document.querySelectorAll('[role="dialog"] a')).find((x) => x.textContent.includes("เปิดหน้านี้ในเบราว์เซอร์")); return a ? a.href : ""; })()`)) as string;
      log("LINE in-app browser: the sheet offers 'เปิดหน้านี้ในเบราว์เซอร์' (openExternalBrowser=1)", lineSheet && ext.includes("openExternalBrowser=1"), ext);
      await lineCtx.close();
      await ctx.close();

      const dctx = await b.createBrowserContext();
      const dp = await dctx.newPage(); await dp.setViewport({ width: 1280, height: 900 });
      const dir = mkdtempSync(join(tmpdir(), "corta-dl-"));
      const cdp = await b.target().createCDPSession(); // downloads are set per browser context
      await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir, browserContextId: (dctx as unknown as { id: string }).id } as never);
      await dp.goto(BASE + "/t/" + lot, { waitUntil: "networkidle0" });
      const grab = async (kind: string, ext: string) => {
        await tapOn(dp, `document.querySelector('button[aria-label="บันทึกหน้านี้"]')`, true); await sleep(300);
        const onTop = await tapOn(dp, `Array.from(document.querySelectorAll('[role="menuitem"]')).find((x) => x.textContent.includes(${JSON.stringify(kind)}))`, true);
        for (let i = 0; i < 100; i++) { const f = readdirSync(dir).find((n) => n.endsWith(ext)); if (f) { await sleep(300); return { onTop, file: readFileSync(join(dir, f)) }; } await sleep(250); }
        return { onTop, file: null as Buffer | null };
      };
      const png = await grab("รูปภาพ", ".png");
      let cover = 0;
      if (png.file) {
        const im = PNG.sync.read(png.file); let minX = im.width, maxX = 0;
        for (let y = 0; y < im.height; y += 4) for (let x = 0; x < im.width; x += 2) { const i = (y * im.width + x) * 4; if (Math.abs(im.data[i] - 248) + Math.abs(im.data[i + 1] - 250) + Math.abs(im.data[i + 2] - 252) > 30) { if (x < minX) minX = x; if (x > maxX) maxX = x; } }
        cover = maxX > minX ? (maxX - minX) / im.width : 0;
      }
      log("desktop: click → บันทึกเป็นรูปภาพ downloads a PNG with the whole passport (not blank)", png.onTop && !!png.file && cover > 0.6, `content across ${Math.round(cover * 100)}% of the width`);
      const pdf = await grab("PDF", ".pdf");
      log("desktop: click → บันทึกเป็น PDF downloads a real PDF", pdf.onTop && !!pdf.file && pdf.file.subarray(0, 5).toString() === "%PDF-" && pdf.file.length > 20000, `${pdf.file?.length ?? 0} bytes`);
      rmSync(dir, { recursive: true, force: true });
      await dctx.close();
    }

    // ---- overview table + manage menu (§5) ---------------------------------------------------------
    await p.goto(BASE + "/app", { waitUntil: "networkidle0" });
    const heads = await ev<string[]>(`Array.from(document.querySelectorAll("table thead th")).map((t) => t.textContent.trim())`);
    const spec = ["วันที่ส่ง", "รหัสล็อต", "จำนวน", "ปลายทาง", "ขนส่ง", "เลขพัสดุ", "สถานะ", "จัดการ"];
    log("5.1 overview columns in order (ประเภท added for mixed farms)", JSON.stringify(heads.filter((h) => h !== "ประเภท")) === JSON.stringify(spec), heads.join(" · "));
    const m = await ev<Record<string, unknown>>(`(() => { const tr = qa.tr(${JSON.stringify(lot)}); const ths = () => Array.from(document.querySelectorAll("table thead th")).map((t) => Math.round(t.getBoundingClientRect().width));
      const ps = Array.from(tr.querySelectorAll("td p")).filter((x) => (x.textContent || "").length > 60);
      const clipped = ps.length > 0 && ps.every((x) => x.scrollWidth > x.clientWidth && x.getBoundingClientRect().height < 24);
      const before = ths(); const keep = ps.map((x) => x.textContent); ps.forEach((x) => { x.textContent = "เชียงใหม่"; }); const after = ths(); ps.forEach((x, k) => { x.textContent = keep[k]; });
      return { waiting: tr.innerText.includes("รอสั่งพิมพ์"), clipped, stable: before.every((w, k) => Math.abs(w - after[k]) <= 1), widths: before.join("/") + " vs " + after.join("/"), h: Math.round(tr.getBoundingClientRect().height), sx: document.documentElement.scrollWidth - innerWidth }; })()`);
    log("§8 long recipient address: cut to one line with …, columns don't move, no sideways scroll", m.clipped === true && m.stable === true && (m.h as number) < 90 && (m.sx as number) <= 1, JSON.stringify(m));
    log("5.2 a new round is รอสั่งพิมพ์", m.waiting === true);
    const urlBefore = p.url();
    await act(`qa.menu(${JSON.stringify(lot)})`, 300);
    const wait = await ev<{ name: string; off: boolean; why: string }[]>(`qa.menuItems()`);
    log("5.3 waiting: แก้ไข ✓ · ใส่เลขพัสดุ ✗ (ใส่ได้หลังพิมพ์ QR แล้ว) · ยกเลิก ✓ — in place", JSON.stringify(wait.map((x) => [x.name, x.off, x.why])) === JSON.stringify([["แก้ไขข้อมูล", false, ""], ["คัดลอกรายการ", false, ""], ["ใส่เลขพัสดุ", true, "ใส่ได้หลังพิมพ์ QR แล้ว"], ["ยกเลิกรายการ", false, ""]]) && p.url() === urlBefore, JSON.stringify(wait));
    await shot("menu-waiting", false);

    // edit (§5.4)
    await act(`qa.click("แก้ไขข้อมูล", document.querySelector('[role="menu"]'))`);
    await waitFor(`document.body.innerText.includes(${JSON.stringify(`แก้ไขรอบส่งออก · ${lot}`)})`, 15000);
    const pre = await ev<Record<string, unknown>>(`({ title: document.body.innerText.includes(${JSON.stringify(`แก้ไขรอบส่งออก · ${lot}`)}), qty: qa.find(document, "input", "จำนวนดอกไม้")?.value, rows: qa.rows().length, code: qa.find(qa.row(1), "select", "หมายเลขบรรจุภัณฑ์")?.value, other: qa.find(qa.row(2), "input", "ชื่อบรรจุภัณฑ์")?.value, addr: qa.find(document, "input", "ที่อยู่ปลายทาง")?.value })`);
    log("5.4 edit form: title ‘แก้ไขรอบส่งออก · LOT’ + old data", pre.title === true && pre.qty === "500" && pre.rows === 3 && pre.code === code && pre.other === OTHER_NAME && pre.addr === LONG_ADDR, JSON.stringify({ ...pre, addr: String(pre.addr).slice(0, 20) }));
    await act(`qa.inp(document, "จำนวนดอกไม้", "600")`);
    const kmBefore = await ev<string>(`qa.find(document, "input", "ระยะทางขนส่ง")?.value`);
    log("edit: the saved distance is still there before anything changes", Number(kmBefore) > 0, `${kmBefore} km`);
    await act(`qa.inp(document, "ที่อยู่ปลายทาง", "99/1 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110")`, 400);
    const recomputed = await waitFor(`Number(qa.find(document, "input", "ระยะทางขนส่ง")?.value) > 0 && qa.find(document, "input", "ระยะทางขนส่ง").value !== ${JSON.stringify(kmBefore)}`, 25000);
    const kmBkk = await ev<string>(`qa.find(document, "input", "ระยะทางขนส่ง")?.value`);
    log("edit: a new recipient address recomputes the distance", recomputed && Number(kmBkk) < 100, `${kmBefore} → ${kmBkk} km`);
    await act(`qa.inp(document, "ที่อยู่ปลายทาง", ${JSON.stringify(LONG_ADDR)})`, 400);
    await waitFor(`qa.find(document, "input", "ระยะทางขนส่ง").value === ${JSON.stringify(kmBefore)}`, 25000);
    // a distance typed by hand is the user's: a later address change leaves it; "ให้ระบบคำนวณ" hands it back
    await act(`qa.inp(document, "ระยะทางขนส่ง", "321")`, 200);
    await act(`qa.inp(document, "ที่อยู่ปลายทาง", ${JSON.stringify(LONG_ADDR + " (ตึกหลัง)")})`, 400); await sleep(2500);
    const kept = await ev<string>(`qa.find(document, "input", "ระยะทางขนส่ง").value`);
    log("edit: a distance typed by hand stays when the address changes after it", kept === "321", kept);
    await act(`qa.click("ให้ระบบคำนวณ")`, 300);
    await act(`qa.inp(document, "ที่อยู่ปลายทาง", ${JSON.stringify(LONG_ADDR)})`, 400);
    const autoBack = await waitFor(`qa.find(document, "input", "ระยะทางขนส่ง").value === ${JSON.stringify(kmBefore)}`, 25000);
    log("edit: ให้ระบบคำนวณ puts the address-based distance back", autoBack);
    await act(`qa.inp(qa.row(0), "จำนวน", "12")`);
    await act(`qa.click(${JSON.stringify(nextLabel)}, null, true)`, 500);
    if (!(await waitFor(`document.body.innerText.includes("ตรวจสอบและยืนยันข้อมูล")`, 8000))) console.log("      edit form errors:", await ev(`Array.from(document.querySelectorAll("p")).map((x) => x.textContent || "").filter((t) => /กรุณา|ต้อง|ไม่ถูกต้อง/.test(t)).join(" | ")`));
    const hl = await ev<Record<string, unknown>>(`(() => { const t = qa.text(); const struck = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && getComputedStyle(e).textDecorationLine.includes("line-through")).map((e) => e.textContent.trim()); return { notice: (t.match(/ตรวจสอบการแก้ไข[^ช]*ช่องที่เปลี่ยน/) || [""])[0], struck }; })()`);
    const struck = hl.struck as string[];
    log("5.4 review highlights the changed fields, old → new", String(hl.notice).length > 0 && struck.some((s) => s.startsWith("500")) && struck.some((s) => /10\b/.test(s)), JSON.stringify(hl));
    await shot("edit-review");
    await act(`qa.click("บันทึก", null, true)`, 400);
    const dlg = await ev<string>(`qa.text(document.querySelector('[role="dialog"]'))`);
    await act(`qa.click("ยืนยัน", document.querySelector('[role="dialog"]') || document, true)`);
    await waitFor(`location.search.includes("edited=")`, 20000);
    const [after] = await sql`SELECT id, quantity, status FROM batches WHERE supplier_id = ${supId}`;
    const evs = await sql`SELECT action, detail FROM batch_events WHERE batch_id = ${lot} ORDER BY at`;
    log("5.4 saved under the same LOT, recomputed, history ‘edit’", dlg.includes(lot) && after?.id === lot && Number(after?.quantity) === 600 && after?.status === "computed" && evs.some((e) => e.action === "edit"), `${after?.id} q=${after?.quantity} ${evs.map((e) => e.action).join(",")}`);
    log("5.4 history page shows the edited banner + row", await waitFor(`document.body.innerText.includes(${JSON.stringify(lot)}) && /แก้ไข/.test(document.body.innerText)`));

    // the carrier's export form loads the same packaging rows and offers อื่นๆ too (§4 — farm and carrier forms)
    {
      const ctx = await b.createBrowserContext();
      const q = await ctx.newPage(); await q.setViewport({ width: 1440, height: 1000 });
      q.on("pageerror", (e) => errs.push("logistic: " + String(e).slice(0, 160)));
      await q.evaluateOnNewDocument(DRIVER);
      await ctx.setCookie({ name: "klora_session", value: lg, domain: "localhost", path: "/" });
      await q.goto(BASE + "/logistic/new", { waitUntil: "networkidle0" });
      const picked = await q.evaluate(`(() => { const s = Array.from(document.querySelectorAll("select")).find((x) => Array.from(x.options).some((o) => o.value === ${JSON.stringify(lot)})); if (!s) return false; qa.set(s, ${JSON.stringify(lot)}); return true; })()`);
      await sleep(700);
      const lg1 = (await q.evaluate(`({ rows: qa.rows().map((r) => qa.find(r, "select", "บรรจุภัณฑ์").value), code: qa.find(qa.row(1), "select", "หมายเลขบรรจุภัณฑ์")?.value, prov: qa.opts(qa.find(document, "select", "จังหวัดปลายทาง")).includes("__other__") })`)) as { rows: string[]; code: string; prov: boolean };
      await q.evaluate(`Array.from(document.querySelectorAll("label")).find((x) => x.textContent.trim() === "ส่งต่างประเทศ").click()`); await sleep(400);
      const air = (await q.evaluate(`qa.opts(qa.find(document, "select", "ท่าอากาศยานต้นทาง")).includes("__other__")`)) as boolean;
      log("§4 carrier export form loads the farm's packaging rows (+ PKG code)", picked === true && JSON.stringify(lg1.rows) === JSON.stringify(["carton", "basket", "other"]) && lg1.code === code, JSON.stringify(lg1));
      log("§4 carrier form: อื่นๆ on จังหวัดปลายทาง + ท่าอากาศยานต้นทาง", lg1.prov === true && air === true, `${lg1.prov} ${air}`);
      const carried = (await q.evaluate(`qa.find(document, "input", "ที่อยู่ปลายทาง")?.value`)) as string;
      log("carrier form: the farm's recipient address comes with the lot", carried === LONG_ADDR, String(carried).slice(0, 40));
      const units = (await q.evaluate(`(() => { const a = qa.find(document, "select", "จำนวนสินค้า"), b = qa.find(document, "select", "จำนวนส่งออก"); return { a: a && a.value, aOther: qa.opts(a).includes("__other__"), b: b && b.value, bOther: qa.opts(b).includes("__other__") }; })()`)) as Record<string, unknown>;
      log("carrier form: quantity units are dropdowns (ดอก from the lot) with อื่นๆ (ระบุ)", units.a === "ดอก" && units.aOther === true && units.b === "ช่อ" && units.bOther === true, JSON.stringify(units));
      // domestic again: the distance comes from the lot's address (the carrier's branch → recipient); picking the lot again refills it
      await q.evaluate(`Array.from(document.querySelectorAll("label")).find((x) => x.textContent.trim() === "ส่งภายในประเทศ").click()`); await sleep(300);
      const kmFilled = () => q.waitForFunction(`Number(qa.find(document, "input", "ระยะทางขนส่ง")?.value) > 0`, { timeout: 25000 }).then(() => true, () => false);
      const km1ok = await kmFilled();
      const km1 = (await q.evaluate(`qa.find(document, "input", "ระยะทางขนส่ง")?.value`)) as string;
      await q.evaluate(`(() => { const s = Array.from(document.querySelectorAll("select")).find((x) => Array.from(x.options).some((o) => o.value === ${JSON.stringify(lot)})); qa.set(s, ""); })()`); await sleep(300);
      await q.evaluate(`(() => { const s = Array.from(document.querySelectorAll("select")).find((x) => Array.from(x.options).some((o) => o.value === ${JSON.stringify(lot)})); qa.set(s, ${JSON.stringify(lot)}); })()`); await sleep(600);
      const km2ok = await kmFilled();
      const km2 = (await q.evaluate(`qa.find(document, "input", "ระยะทางขนส่ง")?.value`)) as string;
      log("carrier form: distance from the lot's address; picking the lot again fills it again", km1ok && km2ok && km1 === km2, `${km1} → ${km2} km`);
      // carrier sign-up link: the button on รายการรับเข้าจากผู้ผลิต opens the panel (read-only here — no link is made)
      await q.goto(BASE + "/logistic/incoming", { waitUntil: "networkidle0" });
      await q.evaluate(`Array.from(document.querySelectorAll("button")).find((x) => x.textContent.includes("ชวนผู้ผลิต")).click()`); await sleep(900);
      const panel = (await q.evaluate(`(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.innerText.includes("สร้างลิงก์"); })()`)) as boolean;
      log("carrier link: + ชวนผู้ผลิต on the incoming page opens the link panel", panel);
      await ctx.close();
    }

    // the carrier prints → printed menu (§5.3)
    const pr = await (await fetch(BASE + "/api/prints", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `klora_session=${lg}` }, body: JSON.stringify({ supplierId: supId, batchId: lot, printedBy: "QA" }) })).json();
    await p.goto(BASE + "/app/history", { waitUntil: "networkidle0" });
    await act(`qa.menu(${JSON.stringify(lot)})`, 300);
    const printed = await ev<{ name: string; off: boolean; why: string }[]>(`qa.menuItems()`);
    log("5.3 printed: แก้ไข ✗ · ใส่เลขพัสดุ ✓ · ยกเลิก ✗ (ให้ผู้ขนส่งยกเลิกการพิมพ์ก่อน)", JSON.stringify(printed.map((x) => [x.name, x.off, x.why])) === JSON.stringify([["แก้ไขข้อมูล", true, "พิมพ์ QR แล้ว · แก้ไขไม่ได้"], ["คัดลอกรายการ", false, ""], ["ใส่เลขพัสดุ", false, ""], ["ยกเลิกรายการ", true, "พิมพ์ QR แล้ว · ให้ผู้ขนส่งยกเลิกการพิมพ์ก่อน"]]) && (await ev(`qa.text(qa.tr(${JSON.stringify(lot)})).includes("พิมพ์แล้ว")`)) === true, JSON.stringify(printed));

    // tracking number (§5.5)
    await act(`qa.click("ใส่เลขพัสดุ", document.querySelector('[role="menu"]'))`, 300);
    const dlg2 = await ev<Record<string, unknown>>(`(() => { const d = document.querySelector('[role="dialog"]') || document.body; return { inputs: d.querySelectorAll("input").length, text: qa.text(d) }; })()`);
    log("5.5 one window: เลขพัสดุ + น้ำหนักรวม", dlg2.inputs === 2 && String(dlg2.text).includes("เลขพัสดุ") && String(dlg2.text).includes("น้ำหนักรวม"), JSON.stringify(dlg2).slice(0, 120));
    await act(`(() => { const d = document.querySelector('[role="dialog"]') || document.body; const i = d.querySelectorAll("input"); qa.set(i[0], "ef123456789th"); qa.set(i[1], "31"); })()`);
    await act(`qa.click("บันทึก", document.querySelector('[role="dialog"]') || document, true)`, 600);
    await waitFor(`qa.text(qa.tr(${JSON.stringify(lot)})).includes("EF123456789TH")`, 10000);
    const trk = await ev<Record<string, unknown>>(`(() => { const a = qa.tr(${JSON.stringify(lot)}).querySelector('a[href*="thailandpost"]'); return { link: a?.href || "", text: a?.textContent || "" }; })()`);
    await act(`qa.menu(${JSON.stringify(lot)})`, 300);
    const mi = await ev<{ name: string }[]>(`qa.menuItems()`);
    const [bt] = await sql`SELECT tracking_no, shipped_weight_kg FROM batches WHERE id = ${lot}`;
    log("5.5 tracking saved (upper-case) + weight, linked to Thai Post", String(trk.link).includes("EF123456789TH") && bt?.tracking_no === "EF123456789TH" && Number(bt?.shipped_weight_kg) === 31, JSON.stringify(trk));
    log("5.5 menu now reads แก้เลขพัสดุ", mi.some((x) => x.name === "แก้เลขพัสดุ"), mi.map((x) => x.name).join(","));
    await act(`document.body.click()`);

    // the carrier cancels its print → waiting again + bell (§5.7)
    await fetch(BASE + `/api/prints/${pr.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `klora_session=${lg}` }, body: JSON.stringify({ cancelled: true }) });
    await p.goto(BASE + "/app/history", { waitUntil: "networkidle0" });
    const back = await ev<boolean>(`qa.text(qa.tr(${JSON.stringify(lot)})).includes("รอสั่งพิมพ์")`);
    await act(`document.querySelector('[aria-label="การแจ้งเตือน"]').click()`, 600);
    const bell = await ev<string>(`qa.text()`);
    log("5.7 print-cancel → รอสั่งพิมพ์ again + bell message", back && /ยกเลิกการพิมพ์/.test(bell), back ? "" : "status not back");
    await p.goto(BASE + "/app/history", { waitUntil: "networkidle0" });

    // cancel with a reason (§5.6)
    await act(`qa.menu(${JSON.stringify(lot)})`, 300);
    await act(`qa.click("ยกเลิกรายการ", document.querySelector('[role="menu"]'))`, 300);
    const offBefore = await ev<boolean>(`qa.btns("ยืนยันยกเลิก")[0]?.disabled`);
    const reasons = await ev<string[]>(`Array.from((document.querySelector('[role="dialog"]') || document).querySelectorAll("button")).map((x) => x.textContent.replace(/[●○]/g, "").trim()).filter((t) => ["ข้อมูลผิด", "ไม่ได้ส่งแล้ว", "บันทึกซ้ำ", "อื่นๆ"].includes(t))`);
    await act(`qa.click("บันทึกซ้ำ", document.querySelector('[role="dialog"]') || document)`);
    const offAfter = await ev<boolean>(`qa.btns("ยืนยันยกเลิก")[0]?.disabled`);
    log("5.6 a reason is required (4 reasons) before ยืนยันยกเลิก", offBefore === true && offAfter === false && reasons.length === 4, `${offBefore}→${offAfter} ${reasons.join(",")}`);
    await act(`qa.click("ยืนยันยกเลิก")`, 800);
    await waitFor(`qa.text(qa.tr(${JSON.stringify(lot)})).includes("ยกเลิก") && !qa.text(qa.tr(${JSON.stringify(lot)})).includes("รอสั่งพิมพ์")`, 10000);
    const gone = await ev<Record<string, unknown>>(`(() => { const tr = qa.tr(${JSON.stringify(lot)}); return { grey: /bg-slate-50/.test(tr.className), struck: getComputedStyle(tr.children[1]).textDecorationLine }; })()`);
    await act(`qa.menu(${JSON.stringify(lot)})`, 300);
    const dead = (await ev<{ name: string; off: boolean; why: string }[]>(`qa.menuItems()`)).filter((x) => x.name !== "คัดลอกรายการ");
    log("5.6 cancelled row is grey + ยกเลิก; every menu item off (ยกเลิกแล้ว)", gone.grey === true && String(gone.struck).includes("line-through") && dead.length === 3 && dead.every((x) => x.off && ["รายการนี้ถูกยกเลิกแล้ว", "ยกเลิกแล้ว"].includes(x.why)), JSON.stringify(gone));
    await shot("cancelled");
    const assets = await (await fetch(BASE + "/api/packaging-assets", { headers: { Cookie: `klora_session=${cookie}` } })).json();
    const mine = (assets as { id: string; uses?: number; priorUses: number }[]).find((a) => a.id === code);
    log("5.6 the reusable basket gets its trip back", mine?.uses === 0 && mine?.priorUses === 5, JSON.stringify(mine));
    await p.goto(BASE + "/app", { waitUntil: "networkidle0" });
    const kpi = await ev<string>(`qa.text()`);
    log("5.6 cancelled round left out of the overview totals", /จำนวนรอบการส่งออก\s*0/.test(kpi), (kpi.match(/จำนวนรอบการส่งออก\s*\S+/) || [""])[0]);

    // ---- คัดลอกรายการ: same product + packaging, new dates + destination → a new LOT ----------------------
    await p.goto(BASE + "/app/history", { waitUntil: "networkidle0" });
    await act(`qa.menu(${JSON.stringify(lot)})`, 300);
    await act(`qa.click("คัดลอกรายการ", document.querySelector('[role="menu"]'))`);
    await waitFor(`location.search.includes("copy=") && document.body.innerText.includes("คัดลอกจาก")`, 15000);
    const cp = await ev<Record<string, unknown>>(`({ qty: qa.find(document, "input", "จำนวนดอกไม้")?.value, rows: qa.rows().length, code: qa.find(qa.row(1), "select", "หมายเลขบรรจุภัณฑ์")?.value, other: qa.find(qa.row(2), "input", "ชื่อบรรจุภัณฑ์")?.value, addr: qa.find(document, "input", "ที่อยู่ปลายทาง")?.value, cut: qa.find(document, "input", "วันที่ตัด")?.value, prov: qa.find(document, "select", "จังหวัดปลายทาง")?.value })`);
    log("คัดลอกรายการ: product + packaging kept, dates + destination blank", cp.qty === "600" && cp.rows === 3 && cp.code === code && cp.other === OTHER_NAME && cp.addr === "" && cp.cut === "" && cp.prov === "", JSON.stringify(cp));
    log("คัดลอกรายการ: the copy starts without the packing photo", await ev<boolean>(`document.querySelectorAll('img[alt="รูปถ่ายตอนแพ็ก"]').length === 0`));
    await act(`qa.date(document, "วันที่ตัด", "2026-10-10")`);
    await act(`qa.date(document, "วันที่จัดส่ง", "2026-10-11")`);
    await act(`qa.sel(document, "จังหวัดปลายทาง", "เชียงใหม่")`);
    await act(`qa.inp(document, "ที่อยู่ปลายทาง", "99 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200")`, 400);
    await waitFor(`Number(qa.find(document, "input", "ระยะทางขนส่ง")?.value) > 0`, 25000);
    await act(`qa.click("ถัดไป", null, true)`, 500);
    await waitFor(`document.body.innerText.includes("ตรวจสอบและยืนยันข้อมูล")`, 8000);
    await act(`qa.click("บันทึก", null, true)`, 400);
    await act(`qa.click("ยืนยัน", document.querySelector('[role="dialog"]') || document, true)`);
    await waitFor(`location.pathname === "/app/history"`, 20000);
    const [nl] = await sql`SELECT id, quantity, packaging_items, product_type, destination_address FROM batches WHERE supplier_id = ${supId} AND id <> ${lot}`;
    const [ev2] = nl ? await sql`SELECT detail FROM batch_events WHERE batch_id = ${nl.id} AND action = 'create'` : [];
    log("saved as a new LOT with the copied product + packaging and the new address", !!nl && nl.id !== lot && Number(nl.quantity) === 600 && (nl.packaging_items as unknown[]).length === 3 && String(nl.destination_address).includes("นิมมานเหมินท์") && (ev2?.detail as { copiedFrom?: string })?.copiedFrom === lot, JSON.stringify({ id: nl?.id, from: (ev2?.detail as { copiedFrom?: string })?.copiedFrom }));

    // ---- §S3 farm resources: several fuel / fertilizer / chemical lines, each with อื่นๆ --------------
    await p.goto(BASE + "/app/farm", { waitUntil: "networkidle0" });
    await act(`qa.click("ข้อมูลการใช้ทรัพยากร")`, 400);
    const fuel0 = await ev<number>(`qa.all(document, "select", "ประเภทเชื้อเพลิง").length`);
    const adds = await ev<number>(`["เพิ่มรายการเชื้อเพลิง", "เพิ่มรายการปุ๋ย", "เพิ่มรายการสารเคมี"].filter((t) => qa.btns(t).length).length`);
    if (adds) await act(`qa.click("เพิ่มรายการเชื้อเพลิง")`, 300);
    const fuel1 = await ev<{ n: number; other: boolean }>(`(() => { const all = qa.all(document, "select", "ประเภทเชื้อเพลิง"); return { n: all.length, other: qa.opts(all[all.length - 1]).includes("other") }; })()`);
    log("§S3 farm resources: + เพิ่มรายการ under fuel / fertilizer / chemical; each line offers อื่นๆ", adds === 3 && fuel1.n === fuel0 + 1 && fuel1.other, `lines ${fuel0} → ${fuel1.n}, add buttons ${adds}, other ${fuel1.other}`);
    await act(`qa.click("ข้อมูลผู้ผลิต")`, 300);
    await act(`qa.click("เพิ่มรายการผลผลิต")`, 300);
    await act(`document.querySelectorAll('[role="radiogroup"][aria-label="ประเภทสินค้า"] [role="radio"]')[1].click()`, 200); // ผลไม้
    await act(`Array.from(document.querySelectorAll("button")).find((x) => (x.textContent || "").includes("พิมพ์ค้นหาชนิดผลไม้")).click()`, 300);
    const all = await ev<string[]>(`Array.from(document.querySelectorAll("div.max-h-64 button")).map((x) => x.textContent.trim())`);
    await act(`qa.set(document.querySelector('input[placeholder="ค้นหา..."]'), "durian")`, 300);
    const found = await ev<string[]>(`Array.from(document.querySelectorAll("div.max-h-64 button")).map((x) => x.textContent.trim())`);
    log("ข้อมูลฟาร์ม: pick ผลไม้ → only fruit listed; typing 'durian' finds ทุเรียน", all.length > 5 && !all.includes("กุหลาบ") && found.includes("ทุเรียน"), `${all.length} fruit · ${found.join(",")}`);
    let saves = 0; const onReq = (r: { method(): string; url(): string }) => { if (r.method() !== "GET" && r.url().includes("/api/suppliers/")) saves++; };
    p.on("request", onReq);
    const cards0 = await ev<number>(`document.querySelectorAll('button[title="ตัวเลือก"]').length`);
    await act(`document.querySelector('input[placeholder="ค้นหา..."]').focus()`, 100);
    await p.keyboard.press("Enter"); await sleep(500);
    const cards1 = await ev<number>(`document.querySelectorAll('button[title="ตัวเลือก"]').length`);
    p.off("request", onReq);
    log("ข้อมูลฟาร์ม: Enter in the search box adds ทุเรียน — and does not save the whole form", cards1 === cards0 + 1 && saves === 0 && (await ev<boolean>(`document.body.innerText.includes("ทุเรียน")`)), `cards ${cards0} → ${cards1}, saves ${saves}`);
    await act(`document.body.click()`, 200);
    const dots = await ev<Record<string, unknown>>(`(() => {
      const btns = Array.from(document.querySelectorAll('button[title="ตัวเลือก"]'));
      const card = btns.findIndex((b) => { let c = b.parentElement; while (c && !String(c.className).includes("rounded-[12px]")) c = c.parentElement; return !!c && !Array.from(c.querySelectorAll("div")).some((d) => String(d.className).includes("rounded-b-[11px]")); });
      if (card < 0) return { card };
      btns[card].click();
      return { card };
    })()`);
    await sleep(300);
    const menuOk = await ev<boolean>(`(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent.includes("ลบรายการนี้")); if (!b) return false; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && b.contains(el); })()`);
    log("ข้อมูลฟาร์ม: ⋮ on a collapsed card shows 'ลบรายการนี้' (not clipped)", dots.card !== -1 && menuOk, JSON.stringify(dots));

    // ---- the form at phone width (§8) --------------------------------------------------------------
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto(BASE + "/app/new", { waitUntil: "networkidle0" });
    await act(`qa.cat("ผลไม้")`, 300);
    await act(`qa.click("เพิ่มบรรจุภัณฑ์")`, 300); await act(`qa.sel(qa.row(1), "บรรจุภัณฑ์", "other")`);
    await act(`qa.sel(qa.row(0), "ขนาด", "custom")`);
    const mob = await ev<Record<string, unknown>>(`(() => { const out = []; for (const r of qa.rows()) { const R = r.getBoundingClientRect(); for (const el of r.querySelectorAll("select, input, button")) { const e = el.getBoundingClientRect(); if (e.width && (e.right > R.right + 1 || e.left < R.left - 1)) out.push(qa.lab(el) || el.tagName); } } return { sx: document.documentElement.scrollWidth - innerWidth, spill: out.slice(0, 5) }; })()`);
    log("§8 phone 390 px: packaging rows fit, no sideways scroll", (mob.sx as number) <= 1 && (mob.spill as string[]).length === 0, JSON.stringify(mob));
    await shot("phone-form");
    log("no page / console errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  } catch (e) {
    log("run", false, String((e as Error).message).slice(0, 200));
  } finally {
    await b.close();
    if (supId) {
      const lots = (await sql`SELECT id FROM batches WHERE supplier_id = ${supId}`).map((r) => r.id as string);
      if (lots.length) await sql`DELETE FROM batch_events WHERE batch_id = ANY(${lots})`;
      await sql`DELETE FROM prints WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ${supId} OR value = ${OTHER_NAME}`;
      await sql`DELETE FROM packaging_assets WHERE owner_supplier_id = ${supId}`;
      await sql`DELETE FROM pack_photos WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`;
    }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT k || id FROM users, (VALUES ('pkg-assets:user:'), ('geocode:user:')) v(k) WHERE email = ${EMAIL})`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
