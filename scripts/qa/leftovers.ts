// After a QA run: nothing the tests made may stay in the shared database. Real data grows (teammates use
// corta.tech), so this looks for QA-tagged rows and rows whose owner is gone — not fixed counts.
//   npx tsx --env-file=.env.local scripts/qa/leftovers.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const q = async (label: string, query: Promise<Record<string, unknown>[]>) => {
  const n = Number((await query)[0].n);
  console.log(n === 0 ? "PASS" : "FAIL", label.padEnd(44), n);
  return n === 0;
};
(async () => {
  const all = await Promise.all([
    q("QA accounts", sql`SELECT count(*) n FROM users WHERE email LIKE '%klora-qa.test%'`),
    q("QA farms", sql`SELECT count(*) n FROM suppliers WHERE farm_name LIKE 'QA %'`),
    q("QA logistic companies", sql`SELECT count(*) n FROM logistic_orgs WHERE company LIKE 'QA %'`),
    q("lots of a farm that is gone", sql`SELECT count(*) n FROM batches b WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = b.supplier_id)`),
    q("lots at a branch that is gone", sql`SELECT count(*) n FROM batches b WHERE b.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM logistic_branches x WHERE x.id = b.branch_id)`),
    q("events without a lot", sql`SELECT count(*) n FROM batch_events e WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.id = e.batch_id)`),
    q("prints of a lot that is gone", sql`SELECT count(*) n FROM prints p WHERE p.batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM batches b WHERE b.id = p.batch_id)`),
    q("ratings of a lot that is gone", sql`SELECT count(*) n FROM ratings r WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.id = r.batch_id)`),
    q("producer links of a company that is gone", sql`SELECT count(*) n FROM carrier_links c WHERE NOT EXISTS (SELECT 1 FROM logistic_orgs o WHERE o.org_code = c.org_code)`),
    q("logistic accounts without a company", sql`SELECT count(*) n FROM users u WHERE u.role = 'logistic' AND NOT EXISTS (SELECT 1 FROM logistic_orgs o WHERE o.org_code = u.org_code)`),
    q("pack photos of a farm that is gone", sql`SELECT count(*) n FROM pack_photos p WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = p.supplier_id)`),
    q("media of a farm that is gone", sql`SELECT count(*) n FROM media m WHERE m.supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = m.supplier_id)`),
    q("certificate files of a farm that is gone", sql`SELECT count(*) n FROM cert_files c WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = c.supplier_id)`),
    q("อื่นๆ entries of a farm that is gone", sql`SELECT count(*) n FROM custom_entries c WHERE c.supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = c.supplier_id)`),
  ]);
  console.log(all.every(Boolean) ? "clean" : "LEFTOVERS");
  if (!all.every(Boolean)) process.exitCode = 1;
})();
