// Certificates at sign-up (Thai Post doc §17, meeting 11-09-2026 mockup): หน่วยงานที่ออก + แนบไฟล์ (PDF/JPG/PNG
// ≤ 2 MB, farm + KYN only), file attached after sign-up or from ข้อมูลฟาร์ม, unused files removed, a bell
// reminder 30 days before expiry, expired certificates hidden on the QR page. Self-cleaning.
//   npx tsx --env-file=.env.local scripts/qa/cert-flow.ts
import { neon } from "@neondatabase/serverless";
import { createHmac } from "crypto";
const BASE = "http://localhost:3123"; const TS = Date.now().toString(36);
const mint = (u: string) => { const p = `${u}:${Date.now() + 3600_000}`; return `${Buffer.from(p).toString("base64url")}.${createHmac("sha256", process.env.KLORA_SESSION_SECRET!).update(p).digest("base64url")}`; };
let fails = 0; const log = (n: string, ok: boolean, note = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };
const day = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const upload = async (cookie: string, bytes: Buffer, name: string, type: string, extra: Record<string, string> = {}) => {
  const fd = new FormData(); fd.append("file", new Blob([bytes], { type }), name); for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const r = await fetch(BASE + "/api/cert-files", { method: "POST", headers: { Cookie: `klora_session=${cookie}` }, body: fd });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const EA = `qa-cert-a-${TS}@klora-qa.test`, EB = `qa-cert-b-${TS}@klora-qa.test`;

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1'`;
  const ids: string[] = [];
  try {
    const reg = async (email: string, u: string, certs: unknown[]) => { const r = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmName: `QA Cert Farm ${u} ${TS}`, address: "อ.แม่ริม จ.เชียงใหม่", gps: "18.91, 98.94", contactName: "QA", flowerType: "มะม่วง", email, username: `qa_cert_${u}_${TS}`, password: "QaPassw0rd!", confirmPassword: "QaPassw0rd!", certifications: certs }) }); const j = await r.json(); return { cookie: /klora_session=([^;]+)/.exec(r.headers.get("set-cookie") || "")![1], id: j.supplier.id as string }; };
    const A = await reg(EA, "a", [
      { kind: "GAP", certNo: "GAP-QA-1", issuer: "กรมวิชาการเกษตร", appliesTo: ["fruit"], expiresAt: day(400), fileId: "CF-FORGED00001" },
      { kind: "GlobalGAP", appliesTo: ["fruit"], expiresAt: day(10) },
      { kind: "Organic Thailand", appliesTo: ["fruit"], expiresAt: day(-5) },
    ]); ids.push(A.id);
    const [s] = await sql`SELECT certifications FROM suppliers WHERE id = ${A.id}`;
    const certs = s.certifications as { issuer?: string; fileId?: string }[];
    log("sign-up keeps หน่วยงานที่ออก, drops a forged file id", certs[0]?.issuer === "กรมวิชาการเกษตร" && !certs[0]?.fileId, JSON.stringify(certs[0]));

    // file right after sign-up (certIndex)
    const up = await upload(A.cookie, PDF, "gap.pdf", "application/pdf", { certIndex: "0" });
    const [s2] = await sql`SELECT certifications FROM suppliers WHERE id = ${A.id}`;
    const fid = (s2.certifications as { fileId?: string; fileName?: string }[])[0]?.fileId;
    log("file attached to certificate 1", up.status === 201 && fid === up.json.id && (s2.certifications as { fileName?: string }[])[0]?.fileName === "gap.pdf", `${up.status} ${fid}`);
    log("wrong file type refused (by content, not name)", (await upload(A.cookie, Buffer.from("hello"), "x.pdf", "application/pdf")).status === 400);
    log("file over 2 MB refused", (await upload(A.cookie, Buffer.concat([PDF, Buffer.alloc(2 * 1024 * 1024)]), "big.pdf", "application/pdf")).status === 400);

    // who can open it
    const open = async (cookie?: string) => (await fetch(`${BASE}/api/cert-files/${fid}`, { headers: cookie ? { Cookie: `klora_session=${cookie}` } : {} }));
    const mine = await open(A.cookie);
    log("the farm opens its file (PDF, private)", mine.status === 200 && mine.headers.get("content-type") === "application/pdf" && /private/.test(mine.headers.get("cache-control") ?? "") && (await mine.text()).startsWith("%PDF"));
    log("KYN opens it", (await open(mint("USR-0003"))).status === 200);
    const B = await reg(EB, "b", []); ids.push(B.id);
    log("another farm cannot", (await open(B.cookie)).status === 403);
    log("a carrier cannot", (await open(mint("USR-0002"))).status === 401 || (await open(mint("USR-0002"))).status === 403);
    log("nobody signed out can", (await open()).status === 401);

    // saving from ข้อมูลฟาร์ม: someone else's file id is dropped; a removed file is deleted
    const other = await upload(B.cookie, PDF, "b.pdf", "application/pdf");
    const cur = (await sql`SELECT certifications FROM suppliers WHERE id = ${A.id}`)[0].certifications as Record<string, unknown>[];
    const patch = await fetch(`${BASE}/api/suppliers/${A.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `klora_session=${A.cookie}` }, body: JSON.stringify({ certifications: [{ ...cur[0], fileId: other.json.id, fileName: "b.pdf" }, cur[1], cur[2]] }) });
    const after = (await sql`SELECT certifications FROM suppliers WHERE id = ${A.id}`)[0].certifications as { fileId?: string }[];
    log("another farm's file id is not accepted", patch.status === 200 && !after[0].fileId);
    log("the dropped file is deleted", (await sql`SELECT count(*)::int n FROM cert_files WHERE id = ${fid}`)[0].n === 0);
    const up2 = await upload(mint("USR-0003"), PDF, "kyn.pdf", "application/pdf", { supplierId: A.id });
    log("KYN can upload for a farm", up2.status === 201 && (await sql`SELECT supplier_id FROM cert_files WHERE id = ${up2.json.id}`)[0]?.supplier_id === A.id);

    // 30-day reminder (once) + QR page hides an expired certificate
    await fetch(`${BASE}/app`, { headers: { Cookie: `klora_session=${A.cookie}` } });
    await fetch(`${BASE}/app`, { headers: { Cookie: `klora_session=${A.cookie}` } });
    const notes = await sql`SELECT title FROM notifications WHERE supplier_id = ${A.id} AND title LIKE 'ใบรับรอง%'`;
    log("bell reminder for the certificate expiring in 10 days — once, not for the far / expired ones", notes.length === 1 && String(notes[0].title).includes("GlobalGAP"), notes.map((n) => n.title).join(" | "));
    const lot = await fetch(`${BASE}/api/batches`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `klora_session=${A.cookie}` }, body: JSON.stringify({ productCategory: "fruit", productType: "มะม่วง", unit: "kg", quantity: 40, cutDate: "2026-10-09", distanceKm: 300, destination: "กรุงเทพฯ", carrier: "ไปรษณีย์ไทย", shippedWeightKg: 45, packagingItems: [] }) }).then((r) => r.json());
    const page = (await (await fetch(`${BASE}/t/${lot.id}`)).text()).replace(/<!-- -->/g, "");
    log("QR page: valid certificates shown, expired one hidden", page.includes("GAP · GAP-QA-1") && page.includes("GlobalGAP") && !page.includes("Organic Thailand"));
    log("QR page never links the files", !page.includes("/api/cert-files/"));
  } catch (e) {
    log("run", false, String((e as Error).message));
  } finally {
    if (ids.length) {
      await sql`DELETE FROM cert_files WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM notifications WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM custom_entries WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM batches WHERE supplier_id = ANY(${ids})`;
      await sql`DELETE FROM suppliers WHERE id = ANY(${ids})`;
    }
    await sql`DELETE FROM rate_limits WHERE key IN (SELECT 'cert-files:user:' || id FROM users WHERE email IN (${EA}, ${EB})) OR key = 'cert-files:user:USR-0003'`;
    await sql`DELETE FROM users WHERE email IN (${EA}, ${EB})`;
    await sql`DELETE FROM rate_limits WHERE key LIKE '%:ip:::1' OR key LIKE 'login:acct:qa_%'`;
  }
  console.log(fails ? `${fails} failed` : "all passed");
})();
