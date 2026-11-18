// Evidence pass (9 Nov 2026): impossible dates are refused, harvest + pack photos live side by side on a lot,
// a photo reused on another lot loses its verified badge (and the public page never names the other lot), the
// carrier's receipt scan binds the tracking number, and an unhandled lot raises one overdue reminder.
// Throwaway *@klora-qa.test accounts + one QA carrier; everything it creates is removed.
//   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/qa/evidence-flow.ts
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
import { qaCarrier, cleanupQaCarriers } from "./qa-carrier";
import { checkRoundDates, overdueLimitDays, isOverdue, todayBangkok, bangkokDate, daysSinceBangkok, harvestPhotoFlag } from "../../src/lib/evidence";
import { PRODUCE_PROFILES } from "../../src/lib/master-data";
import { getSupplier, remindOverdueLots, getPackPhotosFor } from "../../src/lib/store";

const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  - " + note : ""}`); };
const api = async (path: string, method: string, body?: unknown, cookie?: string) => {
  const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: `klora_session=${cookie}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json: any = {}; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text };
};
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(80, 9)]);
const HASH = createHmac("sha256", "qa").update(TS).digest("hex"); // any 64 hex chars

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const EMAIL = `qa-ev-f-${TS}@klora-qa.test`; const farmIds: string[] = []; const lots: string[] = [];
  try {
    // ---- pure rules -----------------------------------------------------------------------------------------
    const today = todayBangkok();
    const ago = (d: number) => todayBangkok(new Date(Date.now() - d * 86400_000));
    const plus = (ymd: string, d: number) => new Date(Date.parse(ymd + "T00:00:00Z") + d * 86400_000).toISOString().slice(0, 10);
    log("checkRoundDates: bad format", checkRoundDates({ cutDate: "09/11/2026" }, "2026-11-09")?.field === "cutDate");
    log("checkRoundDates: 30 Feb is not a date", checkRoundDates({ cutDate: "2026-02-30" }, "2026-11-09")?.error === "รูปแบบวันที่เก็บเกี่ยวไม่ถูกต้อง");
    log("checkRoundDates: future cut date", checkRoundDates({ cutDate: "2026-11-10" }, "2026-11-09")?.error === "วันที่เก็บเกี่ยวต้องไม่เกินวันนี้");
    log("checkRoundDates: planting on/after cut", checkRoundDates({ cutDate: "2026-11-01", plantingDate: "2026-11-01" }, "2026-11-09")?.field === "plantingDate" && checkRoundDates({ cutDate: "2026-11-01", plantingDate: "2026-05-01" }, "2026-11-09") === null);
    log("checkRoundDates: ship before cut", checkRoundDates({ cutDate: "2026-11-05", shipDate: "2026-11-04" }, "2026-11-09")?.error === "วันที่จัดส่งต้องไม่ก่อนวันที่เก็บเกี่ยว" && checkRoundDates({ cutDate: "2026-11-05", shipDate: "2026-11-05" }, "2026-11-09") === null);
    log("todayBangkok 18:30Z is already the next day", todayBangkok(new Date("2026-11-09T18:30:00Z")) === "2026-11-10" && bangkokDate("2026-11-09T18:30:00Z") === "2026-11-10");
    log("daysSinceBangkok", daysSinceBangkok("2026-11-01", new Date("2026-11-09T18:30:00Z")) === 9 && daysSinceBangkok("2027-01-01", new Date("2026-11-09T00:00:00Z")) === 0);
    const longest = [...PRODUCE_PROFILES].sort((a, b) => b.shelfLifeDays - a.shelfLifeDays)[0];
    log("overdueLimitDays: flower 2, longest-lived produce 7", overdueLimitDays({ productCategory: "flower", productType: "กุหลาบ" }) === 2 && overdueLimitDays({ productCategory: longest.category, productType: longest.type }) === 7, `${longest.type} ${longest.shelfLifeDays}d`);
    const lot0 = { productCategory: "flower" as const, productType: "กุหลาบ", cutDate: ago(10), status: "computed" as const };
    log("isOverdue: old unhandled lot", isOverdue(lot0, { printed: false }) === true);
    log("isOverdue false when printed / received / cancelled / draft / fresh", !isOverdue(lot0, { printed: true }) && !isOverdue({ ...lot0, receivedAt: new Date().toISOString() }, { printed: false }) && !isOverdue({ ...lot0, cancelledAt: new Date().toISOString() }, { printed: false }) && !isOverdue({ ...lot0, status: "draft" }, { printed: false }) && !isOverdue({ ...lot0, cutDate: today }, { printed: false }));
    const shot = (iso: string) => ({ takenAt: iso, uploadedAt: iso, verified: true });
    log("harvestPhotoFlag: before / late / ok / unverified ignored", harvestPhotoFlag("2026-11-05", [shot("2026-11-03T05:00:00Z")]) === "before" && harvestPhotoFlag("2026-11-05", [shot("2026-11-07T05:00:00Z")]) === "late" && harvestPhotoFlag("2026-11-05", [shot("2026-11-06T05:00:00Z")]) === null && harvestPhotoFlag("2026-11-05", [{ ...shot("2026-11-01T05:00:00Z"), verified: false }]) === null);

    // ---- accounts: a carrier (sorting centre, may record exports) with a sign-up link, and a farm bound to it ---------
    const C = await qaCarrier(sql, "ev", TS, { providerType: "sorting_center" });
    const link = await api("/api/carrier-links", "POST", { carrierKey: "sorting_center" }, C.cookie);
    const rr = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: `QA Evidence ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email: EMAIL, username: `qa_ev_f_${TS}`, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!", carrierLink: link.json.token }) });
    const rj = await rr.json().catch(() => ({}));
    const F = { id: rj.supplier?.id as string, cookie: /klora_session=([^;]+)/.exec(rr.headers.get("set-cookie") ?? "")?.[1] ?? "" };
    if (!F.id || !F.cookie) throw new Error(`farm sign-up failed: ${rr.status} ${JSON.stringify(rj).slice(0, 120)}`);
    farmIds.push(F.id);

    const ROUND = { productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 40, distanceKm: 300, destination: "กรุงเทพฯ", shippedWeightKg: 45, packagingItems: [] as unknown[] };
    const mk = (over: Record<string, unknown>) => api("/api/batches", "POST", { ...ROUND, cutDate: today, ...over }, F.cookie);

    // ---- 1. dates --------------------------------------------------------------------------------------------
    const fut = await mk({ cutDate: plus(today, 1) });
    log("POST: future cut date -> 400", fut.status === 400 && fut.json.error === "วันที่เก็บเกี่ยวต้องไม่เกินวันนี้", `${fut.status} ${fut.json.error}`);
    const pl = await mk({ plantingDate: today });
    log("POST: planting >= cut -> 400", pl.status === 400 && pl.json.error === "วันที่ปลูกต้องอยู่ก่อนวันที่เก็บเกี่ยว", `${pl.status} ${pl.json.error}`);
    const sh = await mk({ shipDate: ago(1) });
    log("POST: ship date before cut -> 400", sh.status === 400 && sh.json.error === "วันที่จัดส่งต้องไม่ก่อนวันที่เก็บเกี่ยว", `${sh.status} ${sh.json.error}`);
    const okLot = await mk({ plantingDate: ago(90) });
    log("POST: cut date today (Bangkok) -> 201", okLot.status === 201 && !!okLot.json.id, `${okLot.status} ${okLot.json.error ?? ""}`);
    if (okLot.json.id) lots.push(okLot.json.id);

    // ---- 2. harvest + pack photos on one lot ------------------------------------------------------------------
    const up = async (stage: string, hash?: string, minutesAgo = 120) => {
      const fd = new FormData(); fd.append("file", new Blob([JPG], { type: "image/jpeg" }), "p.jpg");
      fd.append("takenAt", new Date(Date.now() - minutesAgo * 60_000).toISOString()); fd.append("takenSrc", "exif"); fd.append("stage", stage); if (hash) fd.append("srcHash", hash);
      const r = await fetch(BASE + "/api/pack-photos", { method: "POST", headers: { Cookie: `klora_session=${F.cookie}` }, body: fd });
      return { status: r.status, json: await r.json().catch(() => ({})) };
    };
    const hv1 = await up("harvest", HASH); const pk1 = await up("pack"); const pk2 = await up("pack");
    log("harvest upload: stage stored, verified, not reused", hv1.status === 201 && hv1.json.stage === "harvest" && hv1.json.verified === true && hv1.json.reused === false, JSON.stringify(hv1.json).slice(0, 140));
    log("bad srcHash is ignored", (await up("pack", "not-a-hash")).status === 201 && (await sql`SELECT count(*)::int n FROM pack_photos WHERE supplier_id = ${F.id} AND src_hash IS NOT NULL`)[0].n === 1);
    const L2 = (await mk({ packPhotoIds: [pk1.json.id], harvestPhotoIds: [hv1.json.id] })).json.id as string; lots.push(L2);
    const stages = async (lot: string) => (await sql`SELECT stage, count(*)::int n FROM pack_photos WHERE batch_id = ${lot} GROUP BY stage`).reduce((m, r) => ({ ...m, [r.stage as string]: r.n as number }), {} as Record<string, number>);
    let st = await stages(L2);
    log("lot saved with one pack and one harvest photo", st.pack === 1 && st.harvest === 1, JSON.stringify(st));
    const body = { ...ROUND, cutDate: today };
    const putPack = await api(`/api/batches/${L2}`, "PUT", { ...body, packPhotoIds: [pk2.json.id] }, F.cookie);
    st = await stages(L2);
    log("PUT with only packPhotoIds changes pack, leaves harvest", putPack.status === 200 && st.pack === 1 && st.harvest === 1 && (await sql`SELECT 1 FROM pack_photos WHERE id = ${pk1.json.id}`).length === 0 && (putPack.json.changes as { field: string }[]).some((c) => c.field === "packPhotos") && !(putPack.json.changes as { field: string }[]).some((c) => c.field === "harvestPhotos"), JSON.stringify(putPack.json.changes));
    const putHv = await api(`/api/batches/${L2}`, "PUT", { ...body, harvestPhotoIds: [] }, F.cookie);
    st = await stages(L2);
    log("PUT with only harvestPhotoIds drops harvest, leaves pack", putHv.status === 200 && !st.harvest && st.pack === 1 && (putHv.json.changes as { label: string }[]).some((c) => c.label === "รูปตอนเก็บเกี่ยว"), JSON.stringify(putHv.json.changes));
    const stray = await api(`/api/batches/${L2}`, "PUT", { ...body, harvestPhotoIds: [pk2.json.id] }, F.cookie);
    st = await stages(L2);
    log("a pack photo id sent as a harvest photo is ignored", stray.status === 200 && !st.harvest && st.pack === 1, JSON.stringify(st));

    // ---- 3. the same file on a second lot --------------------------------------------------------------------
    const hv2 = await up("harvest", HASH); // not yet attached anywhere: hv1 was dropped by the PUT above
    const hv3 = await up("harvest", createHmac("sha256", "qa2").update(TS).digest("hex"));
    const putBack = await api(`/api/batches/${L2}`, "PUT", { ...body, harvestPhotoIds: [hv2.json.id] }, F.cookie);
    log("first lot keeps the photo (nothing else uses the file yet)", putBack.status === 200 && (await sql`SELECT count(*)::int n FROM pack_photos WHERE batch_id = ${L2} AND stage = 'harvest'`)[0].n === 1);
    const hv4 = await up("harvest", HASH);
    log("upload response: reused true, no lot ids", hv4.json.reused === true && hv4.json.verified === false && hv4.json.reusedIn === undefined && !JSON.stringify(hv4.json).includes("LOT-"), JSON.stringify(hv4.json).slice(0, 160));
    const L3 = (await mk({ harvestPhotoIds: [hv4.json.id] })).json.id as string; lots.push(L3);
    const viaKyn = (await getPackPhotosFor([L3], { withLots: true }))[L3] ?? [];
    log("that lot's photo is not verified and the KYN path names the first lot", viaKyn.length === 1 && viaKyn[0].reused === true && viaKyn[0].verified === false && viaKyn[0].reusedIn?.includes(L2) === true, JSON.stringify(viaKyn.map((p) => [p.reused, p.verified, p.reusedIn])));
    const firstLot = ((await getPackPhotosFor([L2], { withLots: true }))[L2] ?? []).filter((p) => p.stage === "harvest");
    log("the first lot keeps its badge: only the later copy is flagged", firstLot.length === 1 && firstLot[0].reused === false && firstLot[0].verified === true, JSON.stringify(firstLot.map((p) => [p.reused, p.verified])));
    const kynPage = (await (await fetch(`${BASE}/kyn/incoming`, { headers: { Cookie: `klora_session=${mint("USR-0003")}` } })).text()).replace(/\\"/g, '"');
    log("KYN incoming carries reusedIn for it", kynPage.includes(`"reusedIn":["${L2}"]`));

    // ---- 4. receipt scan --------------------------------------------------------------------------------------
    const NOTE = `กล่องบุบ ${TS}`; const TRACK = `TH${Date.now().toString().slice(-9)}`;
    const recv = (cookie: string, over: Record<string, unknown> = {}) => api(`/api/batches/${L3}`, "PATCH", { action: "receive", condition: "damaged", note: NOTE, trackingNo: TRACK, ...over }, cookie);
    log("farm cannot receive", (await recv(F.cookie)).status === 403);
    const early = await recv(C.cookie);
    log("before the QR is printed -> 409", early.status === 409 && early.json.error === "ต้องพิมพ์ฉลาก QR ก่อนรับของ", `${early.status} ${early.json.error}`);
    const pr = await api("/api/prints", "POST", { supplierId: F.id, batchId: L3 }, C.cookie);
    log("carrier prints the label", pr.status === 201, String(pr.status));
    log("condition is required", (await recv(C.cookie, { condition: undefined })).status === 400);
    log("damaged needs a note", (await recv(C.cookie, { note: "" })).status === 400);
    log("bad tracking number refused", (await recv(C.cookie, { trackingNo: "a b" })).json.error === "เลขพัสดุไม่ถูกต้อง");
    const rc = await recv(C.cookie);
    log("receive -> 200 with receivedAt, trackingBy carrier, in_transit", rc.status === 200 && !!rc.json.receivedAt && rc.json.trackingBy === "carrier" && rc.json.trackingNo === TRACK && rc.json.shipmentStatus === "in_transit" && rc.json.receivedCondition === "damaged" && rc.json.receivedBy === C.userId, `${rc.status} ${rc.json.error ?? ""} ${rc.json.shipmentStatus}`);
    const ev = await sql`SELECT detail FROM batch_events WHERE batch_id = ${L3} AND action = 'receive'`;
    log("a receive event was recorded", ev.length === 1 && (ev[0].detail as { condition: string }).condition === "damaged");
    const notes = await sql`SELECT title, body, kind FROM notifications WHERE supplier_id = ${F.id}`;
    log("the farm got the receipt notification (warning, with the note)", notes.some((n) => n.title === `ผู้ขนส่งรับของล็อต ${L3} แล้ว` && String(n.body).includes(NOTE) && n.kind === "warning"));
    log("the status change notified the farm through the status branch", notes.some((n) => n.title === `สถานะขนส่ง ${L3}: กำลังขนส่ง`));
    const again = await recv(C.cookie);
    log("second receive -> 409", again.status === 409 && String(again.json.error).startsWith("รับของแล้วเมื่อ"), `${again.status} ${again.json.error}`);
    const farmTrack = await api(`/api/batches/${L3}`, "PATCH", { action: "tracking", trackingNo: "TH0000000000" }, F.cookie);
    log("the farm cannot edit a number the carrier bound", farmTrack.status === 409 && farmTrack.json.error === "ผู้ขนส่งผูกเลขพัสดุไว้แล้ว แก้ได้จากฝั่งผู้ขนส่งเท่านั้น", `${farmTrack.status}`);
    const carrierTrack = await api(`/api/batches/${L3}`, "PATCH", { action: "tracking", trackingNo: TRACK }, C.cookie);
    log("the carrier may still edit it", carrierTrack.status === 200);
    const g1 = await api(`/api/batches/${L3}`, "GET", undefined, C.cookie);
    log("GET summary for the carrier and the farm, not for anonymous", g1.status === 200 && g1.json.printed === true && g1.json.receivedCondition === "damaged" && (await api(`/api/batches/${L3}`, "GET", undefined, F.cookie)).status === 200 && (await api(`/api/batches/${L3}`, "GET")).status === 401);
    // public surfaces carry none of it
    const pub = await api(`/api/trace/${L3}`, "GET");
    const page = (await (await fetch(`${BASE}/t/${L3}`)).text()).replace(/<!-- -->/g, "");
    const bad = [TRACK, NOTE, L2, C.userId];
    log("GET /api/trace: no tracking number, note, receiver or other lot id", !bad.some((b) => pub.text.includes(b)), bad.filter((b) => pub.text.includes(b)).join(","));
    log("/t page: same", !bad.some((b) => page.includes(b)), bad.filter((b) => page.includes(b)).join(","));
    log("public JSON carries the evidence block (producer-declared, receipt time)", pub.json.evidence?.harvestDateSource === "producer" && !!pub.json.evidence?.receivedAt && !!pub.json.evidence?.labelPrintedAt && pub.json.evidence?.harvestPhotoAt === undefined, JSON.stringify(pub.json.evidence));
    log("QR page: source card, tile captions, receipt row", page.includes("ที่มาของข้อมูล") && page.includes("ผู้ผลิตแจ้ง") && page.includes("คำนวณจากวันที่ผู้ผลิตแจ้ง") && page.includes("บันทึกโดยผู้ขนส่ง") && page.includes("เวลาจากระบบ"));
    const L5 = (await mk({ harvestPhotoIds: [hv3.json.id], packPhotoIds: [] })).json.id as string; lots.push(L5);
    const page5 = (await (await fetch(`${BASE}/t/${L5}`)).text()).replace(/<!-- -->/g, "");
    log("QR page: harvest section, verified caption and source row for a lot with its own harvest photo", page5.includes("ภาพตอนเก็บเกี่ยว") && page5.includes("ถ่ายเมื่อ") && page5.includes("มีรูปตอนเก็บเกี่ยว ถ่ายเมื่อ") && !page5.includes("ภาพตอนแพ็กสินค้า"));
    const page3 = (await (await fetch(`${BASE}/t/${L3}`)).text()).replace(/<!-- -->/g, "");
    log("QR page: a reused harvest photo is not called verified", page3.includes("ภาพตอนเก็บเกี่ยว") && page3.includes("บันทึกภาพเมื่อ") && !page3.includes("มีรูปตอนเก็บเกี่ยว ถ่ายเมื่อ"));

    // ---- 5. carrier PATCH with a ship date before the cut date -------------------------------------------------------
    const early2 = await api(`/api/batches/${L2}`, "PATCH", { shipType: "domestic", shipDate: ago(5), destination: "กรุงเทพฯ", shippedWeightKg: 45 }, C.cookie);
    log("carrier ship date before the cut date -> 400", early2.status === 400 && early2.json.error === "วันที่จัดส่งต้องไม่ก่อนวันที่เก็บเกี่ยว", `${early2.status} ${early2.json.error}`);

    // ---- 7. overdue reminder ------------------------------------------------------------------------------------------
    const L4 = (await mk({ cutDate: ago(10) })).json.id as string; if (L4) lots.push(L4);
    const sup = await getSupplier(F.id);
    await remindOverdueLots(sup!); await remindOverdueLots(sup!);
    const title = `ล็อต ${L4} เก็บเกี่ยวแล้วยังไม่ได้ส่ง`;
    const n = await sql`SELECT body, kind FROM notifications WHERE supplier_id = ${F.id} AND title = ${title}`;
    log("remindOverdueLots twice -> one warning notification", n.length === 1 && n[0].kind === "warning" && String(n[0].body).includes("ผ่านมา 10 วันแล้ว"), String(n[0]?.body ?? "").slice(0, 60));
    log("no reminder for fresh, printed or received lots", !(await sql`SELECT 1 FROM notifications WHERE supplier_id = ${F.id} AND title LIKE ${"ล็อต %เก็บเกี่ยวแล้วยังไม่ได้ส่ง"} AND title NOT LIKE ${"%" + L4 + "%"}`).length);
    const inc = (await (await fetch(`${BASE}/logistic/incoming`, { headers: { Cookie: `klora_session=${C.cookie}` } })).text()).replace(/<!-- -->/g, "");
    log("carrier incoming: ค้าง pill, รับของแล้ว mark, filter option", inc.includes("ค้าง 10 วัน") && inc.includes("รับของแล้ว") && inc.includes("ค้างเกินกำหนด"));
    const scan = (await (await fetch(`${BASE}/logistic/scan?lot=${L3}`, { headers: { Cookie: `klora_session=${C.cookie}` } })).text());
    log("scan page opens with ?lot=", scan.includes("สแกนรับของ"));
  } catch (e) {
    log("run", false, String((e as Error).stack ?? e).slice(0, 400));
  } finally {
    if (farmIds.length) {
      await sql`DELETE FROM batch_events WHERE batch_id IN (SELECT id FROM batches WHERE supplier_id = ANY(${farmIds}))`;
      await sql`DELETE FROM pack_photos WHERE supplier_id = ANY(${farmIds})`;
      await sql`DELETE FROM notifications WHERE supplier_id = ANY(${farmIds})`;
      await sql`DELETE FROM prints WHERE supplier_id = ANY(${farmIds})`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ANY(${farmIds})`;
      await sql`DELETE FROM batches WHERE supplier_id = ANY(${farmIds})`;
      await sql`DELETE FROM suppliers WHERE id = ANY(${farmIds})`;
    }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'pack-photos:user:' || id FROM users WHERE email = ${EMAIL})`;
    await sql`DELETE FROM users WHERE email = ${EMAIL}`;
    await cleanupQaCarriers(sql);
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
