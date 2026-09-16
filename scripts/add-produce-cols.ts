// One-off migration (16 Sep 2026): extend flowers → fruit + vegetables.
//   npx tsx --env-file=.env.local scripts/add-produce-cols.ts
// Adds nullable columns, backfills existing rows as flowers counted in stems, verifies.
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS product_category text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS product_type text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS quantity double precision`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS unit text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS planting_date text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS ripeness_at_harvest text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS grade text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS ethylene_used boolean`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS ethylene_note text`;
  await sql`UPDATE batches SET product_category = 'flower' WHERE product_category IS NULL`;
  await sql`UPDATE batches SET unit = 'stem' WHERE unit IS NULL`;
  await sql`UPDATE batches SET quantity = flower_count WHERE quantity IS NULL`;

  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS certifications jsonb`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS product_categories text[]`;
  await sql`UPDATE suppliers SET product_categories = ARRAY['flower'] WHERE product_categories IS NULL`;

  const b = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'batches' AND column_name IN ('product_category','product_type','quantity','unit','planting_date','ripeness_at_harvest','grade','ethylene_used','ethylene_note') ORDER BY 1`;
  const s = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name IN ('certifications','product_categories') ORDER BY 1`;
  const chk = await sql`SELECT count(*)::int total, count(*) FILTER (WHERE unit = 'stem' AND product_category = 'flower' AND quantity = flower_count)::int backfilled FROM batches`;
  console.log("batches cols:", b.map((r) => r.column_name).join(", "));
  console.log("suppliers cols:", s.map((r) => r.column_name).join(", "));
  console.log("backfill:", JSON.stringify(chk[0]));
})();
