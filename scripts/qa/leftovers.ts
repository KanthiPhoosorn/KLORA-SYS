// After a QA run: nothing the tests made may stay in the shared database.
//   npx tsx --env-file=.env.local scripts/qa/leftovers.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const q = async (label: string, query: Promise<Record<string, unknown>[]>, want?: number) => {
  const n = Number((await query)[0].n);
  const ok = want == null ? n === 0 : n === want;
  console.log(ok ? "PASS" : "FAIL", label.padEnd(36), n);
  return ok;
};
(async () => {
const all = await Promise.all([
  q("QA users", sql`SELECT count(*) n FROM users WHERE email LIKE '%klora-qa.test%'`),
  q("QA farms", sql`SELECT count(*) n FROM suppliers WHERE farm_name LIKE 'QA %'`),
  q("farms (4 real ones)", sql`SELECT count(*) n FROM suppliers`, 4),
  q("lots", sql`SELECT count(*) n FROM batches`, 10),
  q("ratings", sql`SELECT count(*) n FROM ratings`),
  q("pack_photos", sql`SELECT count(*) n FROM pack_photos`),
  q("media", sql`SELECT count(*) n FROM media`),
  q("cert_files", sql`SELECT count(*) n FROM cert_files`),
  q("carrier_links", sql`SELECT count(*) n FROM carrier_links`),
  q("custom_entries", sql`SELECT count(*) n FROM custom_entries`),
  q("events without a lot", sql`SELECT count(*) n FROM batch_events e WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.id = e.batch_id)`),
]);
console.log(all.every(Boolean) ? "clean" : "LEFTOVERS");
if (!all.every(Boolean)) process.exitCode = 1;
})();
