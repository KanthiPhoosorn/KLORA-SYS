// Manage menu (Thai Post doc §5): edit while waiting (same LOT, diff, history, recompute), tracking
// number only after printing, logistic print-cancel → back to waiting + bell, soft cancel with reason
// (out of shared lists, printing refused, reusable trip returned). Self-cleaning.
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36); const EMAIL = `qa-manage-${TS}@klora-qa.test`;
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => { const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})), cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")?.[1], location: r.headers.get("location") }; };
const page = async (path: string, cookie: string) => { const r = await fetch(BASE + path, { redirect: "manual", headers: { Cookie: `klora_session=${cookie}` } }); return { status: r.status, location: r.headers.get("location"), html: (await r.text()).replace(/<!-- -->/g, "") }; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const lg = mint("USR-0002");
  let supId = ""; const assets: string[] = []; const printIds: string[] = [];
  try {
    const reg = await api("/api/auth/register", "POST", { farmName: "QA Manage Farm " + TS, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email: EMAIL, username: "qa_manage_" + TS, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!" });
    supId = reg.json.supplier?.id; const cookie = reg.cookie!;
    const crate = await api("/api/packaging-assets", "POST", { kind: "crate" }, cookie);
    if (crate.json.id) assets.push(crate.json.id);
    const round = { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 40, cutDate: "2026-10-08", distanceKm: 300, destination: "กรุงเทพฯ", carrier: "ไปรษณีย์ไทย", shippedWeightKg: 45,
      packagingItems: [{ v: 2, kind: "crate", usage: "reusable", assetId: crate.json.id, size: "M", quantity: 2, unit: "ลัง", inners: [] }] };
    const b = await api("/api/batches", "POST", round, cookie);
    const id = b.json.id;
    log("lot created + computed", b.status === 201 && b.json.status === "computed", `${b.status} ${id}`);

    // แก้ไขข้อมูล while waiting
    const ed = await api(`/api/batches/${id}`, "PUT", { ...round, quantity: 55, destination: "เชียงใหม่", shippedWeightKg: 60 }, cookie);
    log("edit keeps the LOT code + recomputes", ed.status === 200 && ed.json.batch?.id === id && ed.json.batch?.quantity === 55 && ed.json.batch?.status === "computed", `${ed.status}`);
    const labels = (ed.json.changes ?? []).map((c: { label: string }) => c.label);
    log("edit lists what changed", labels.includes("จำนวน") && labels.includes("จังหวัดปลายทาง") && labels.includes("น้ำหนักรวมหลังแพ็ก (กก.)") && !labels.includes("ชนิด"), labels.join(","));
    const ev = await sql`SELECT action FROM batch_events WHERE batch_id = ${id} ORDER BY at`;
    log("history: create + edit", ev.map((e) => e.action).join(",") === "create,edit", ev.map((e) => e.action).join(","));
    const editPage = await page(`/app/new?edit=${id}`, cookie);
    log("edit form opens with the LOT title", editPage.status === 200 && editPage.html.includes(`แก้ไขรอบส่งออก · ${id}`));
    log("tracking refused before printing", (await api(`/api/batches/${id}`, "PATCH", { action: "tracking", trackingNo: "EF123456789TH" }, cookie)).status === 409);

    // the carrier prints the QR
    const pr = await api("/api/prints", "POST", { supplierId: supId, batchId: id, printedBy: "QA" }, lg);
    if (pr.json.id) printIds.push(pr.json.id);
    log("printed", pr.status === 201);
    log("edit refused after printing", (await api(`/api/batches/${id}`, "PUT", round, cookie)).status === 409);
    log("cancel refused after printing", (await api(`/api/batches/${id}`, "PATCH", { action: "cancel", reason: "ข้อมูลผิด" }, cookie)).status === 409);
    const ep = await page(`/app/new?edit=${id}`, cookie);
    // streamed under the portal layout, Next answers 200 + an in-page redirect to /app/history
    log("edit page bounces once printed", (ep.status === 307 && (ep.location ?? "").includes("/app/history")) || (ep.status === 200 && ep.html.includes("/app/history") && /NEXT_REDIRECT|http-equiv="refresh"/.test(ep.html) && !ep.html.includes(`แก้ไขรอบส่งออก · ${id}`)), `${ep.status} ${ep.location}`);
    const tr = await api(`/api/batches/${id}`, "PATCH", { action: "tracking", trackingNo: "ef123456789th", weightKg: 62 }, cookie);
    log("tracking saved (upper-case) + weight recomputes", tr.status === 200 && tr.json.trackingNo === "EF123456789TH" && tr.json.shippedWeightKg === 62, `${tr.status} ${tr.json.trackingNo} ${tr.json.shippedWeightKg}`);

    // the carrier cancels its print → waiting again, the farm is told
    const pc = await api(`/api/prints/${pr.json.id}`, "PATCH", { cancelled: true }, lg);
    const [bell] = await sql`SELECT title FROM notifications WHERE supplier_id = ${supId} AND title LIKE ${"%ยกเลิกการพิมพ์%"}`;
    log("print-cancel → farm bell", pc.status === 200 && !!bell, String(bell?.title));
    log("edit allowed again", (await api(`/api/batches/${id}`, "PUT", round, cookie)).status === 200);

    // ยกเลิกรายการ
    const usesBefore = (await api("/api/packaging-assets", "GET", undefined, cookie)).json.find((a: { id: string }) => a.id === crate.json.id)?.uses;
    log("cancel needs a reason", (await api(`/api/batches/${id}`, "PATCH", { action: "cancel" }, cookie)).status === 400);
    log("logistic cannot cancel a farm's round", (await api(`/api/batches/${id}`, "PATCH", { action: "cancel", reason: "x" }, lg)).status === 403);
    const cx = await api(`/api/batches/${id}`, "PATCH", { action: "cancel", reason: "บันทึกซ้ำ" }, cookie);
    log("cancelled with reason", cx.status === 200 && !!cx.json.cancelledAt && cx.json.cancelReason === "บันทึกซ้ำ", `${cx.status}`);
    const usesAfter = (await api("/api/packaging-assets", "GET", undefined, cookie)).json.find((a: { id: string }) => a.id === crate.json.id)?.uses;
    log("reusable crate gets its trip back", usesBefore === 1 && usesAfter === 0, `${usesBefore} → ${usesAfter}`);
    log("printing a cancelled lot refused", (await api("/api/prints", "POST", { supplierId: supId, batchId: id }, lg)).status === 409);
    const lots = await api("/api/batches", "GET", undefined, lg); // what logistic lists are built from
    log("cancelled lot left the logistic lists", lots.status === 200 && Array.isArray(lots.json) && lots.json.length > 0 && !lots.json.some((x: { id: string }) => x.id === id), String(lots.status));
    const hist = await page("/app/history", cookie);
    log("history still shows it, greyed as ยกเลิก", hist.status === 200 && hist.html.includes(id) && hist.html.includes("ยกเลิก"));
    log("edit refused on a cancelled lot", (await api(`/api/batches/${id}`, "PUT", round, cookie)).status === 409);
    const ev2 = await sql`SELECT action FROM batch_events WHERE batch_id = ${id} ORDER BY at`;
    log("history: print, tracking, print_cancel, cancel", ["print", "tracking", "print_cancel", "cancel"].every((a) => ev2.some((e) => e.action === a)), ev2.map((e) => e.action).join(","));
  } finally {
    if (printIds.length) await sql`DELETE FROM prints WHERE id = ANY(${printIds})`;
    if (assets.length) await sql`DELETE FROM packaging_assets WHERE id = ANY(${assets})`;
    if (supId) {
      await sql`DELETE FROM batch_events WHERE batch_id IN (SELECT id FROM batches WHERE supplier_id = ${supId})`;
      await sql`DELETE FROM prints WHERE supplier_id = ${supId}`;
      await sql`DELETE FROM notifications WHERE supplier_id = ${supId}`; await sql`DELETE FROM batches WHERE supplier_id = ${supId}`; await sql`DELETE FROM suppliers WHERE id = ${supId}`;
    }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'pkg-assets:user:' || id FROM users WHERE email = ${EMAIL})`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`; await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
