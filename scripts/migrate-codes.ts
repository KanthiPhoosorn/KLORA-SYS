// One-off migration (9 Oct 2026, Thai Post doc tab "เปลี่ยนรหัส"):
//   SUP-YYYY-NNNN → CID-NNNN   every organisation (farms here; logistic accounts get users.org_code)
//   BAT-YYYY-NNNN → LOT-YYMM-NNNN   the lot keeps one code from the farm to the QR
// Farms keep their primary key (referenced by 7 tables) and get a display `code`; new farms are
// created with id = code. Lots are renamed in place (only batches.id + prints.batch_id refer to
// them); the old id stays in `legacy_id` so QR stickers already printed with /trace/BAT-… still open.
// Idempotent — safe to re-run.   npx tsx --env-file=.env.local scripts/migrate-codes.ts [--columns]
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const pad = (n: number) => String(n).padStart(4, "0");
const num = (s: string | null) => (s ? parseInt(/(\d+)$/.exec(s)?.[1] ?? "0", 10) : 0);
const ym = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === "year")!.value}${p.find((x) => x.type === "month")!.value}`;
};

(async () => {
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code text`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS org_code text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS legacy_id text`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS suppliers_code_uq ON suppliers (code)`;
  // org_code is shared by every account of one logistic organisation — not unique
  await sql`DROP INDEX IF EXISTS users_org_code_uq`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS batches_legacy_id_uq ON batches (legacy_id)`;
  // --columns: add the columns only (run before deploying code that reads them)
  if (process.argv.includes("--columns")) return console.log("columns ready");

  // CID — one running number for every organisation
  const codes = [...(await sql`SELECT code FROM suppliers WHERE code IS NOT NULL`), ...(await sql`SELECT org_code AS code FROM users WHERE org_code IS NOT NULL`)];
  let cid = codes.reduce((m, r) => Math.max(m, num(r.code as string)), 0);
  for (const s of await sql`SELECT id FROM suppliers WHERE code IS NULL ORDER BY created_at, id`) {
    await sql`UPDATE suppliers SET code = ${"CID-" + pad(++cid)} WHERE id = ${s.id}`;
  }
  for (const u of await sql`SELECT id FROM users WHERE role = 'logistic' AND org_code IS NULL ORDER BY created_at, id`) {
    await sql`UPDATE users SET org_code = ${"CID-" + pad(++cid)} WHERE id = ${u.id}`;
  }

  // LOT — rename lots that still carry a BAT id
  const lots = await sql`SELECT id FROM batches WHERE id LIKE 'LOT-%'`;
  let lot = lots.reduce((m, r) => Math.max(m, num(r.id as string)), 0);
  const old = await sql`SELECT id, created_at FROM batches WHERE id NOT LIKE 'LOT-%' ORDER BY created_at, id`;
  for (const b of old) {
    const next = `LOT-${ym(b.created_at as string)}-${pad(++lot)}`;
    await sql.transaction([
      sql`UPDATE prints SET batch_id = ${next} WHERE batch_id = ${b.id}`,
      sql`UPDATE notifications SET title = replace(title, ${b.id}, ${next}), body = replace(body, ${b.id}, ${next}) WHERE title LIKE ${"%" + b.id + "%"} OR body LIKE ${"%" + b.id + "%"}`,
      sql`UPDATE batches SET legacy_id = id, id = ${next} WHERE id = ${b.id}`,
    ]);
    console.log(`${b.id} → ${next}`);
  }
  console.log("suppliers:", (await sql`SELECT id, code FROM suppliers ORDER BY code`).map((r) => `${r.id}=${r.code}`).join(", "));
  console.log("logistic:", (await sql`SELECT id, org_code FROM users WHERE role = 'logistic' ORDER BY org_code`).map((r) => `${r.id}=${r.org_code}`).join(", "));
  console.log("prints left on BAT:", (await sql`SELECT count(*)::int n FROM prints WHERE batch_id NOT LIKE 'LOT-%'`)[0].n);
})();
