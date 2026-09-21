// One-off migration (22 Sep 2026): KYN spec gaps — inner packaging materials, air-freight leg,
// carrier-restricted signup links, KYN-editable reference factors.
//   npx tsx --env-file=.env.local scripts/add-spec-cols.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS inner_materials jsonb`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS flight_distance_km double precision`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS origin_airport text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS dest_airport text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS signup_via text`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at text NOT NULL, updated_by text)`;
  const b = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'batches' AND column_name IN ('inner_materials','flight_distance_km','origin_airport','dest_airport') ORDER BY 1`;
  const s = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'signup_via'`;
  const t = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'app_settings' ORDER BY ordinal_position`;
  console.log("batches:", b.map((r) => r.column_name).join(", "), "| suppliers:", s.map((r) => r.column_name).join(","), "| app_settings:", t.map((r) => r.column_name).join(", "));
})();
