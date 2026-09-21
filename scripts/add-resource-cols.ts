// One-off migration (21 Sep 2026): resource types (KYN sheet) + per-product monthly yield lines.
//   npx tsx --env-file=.env.local scripts/add-resource-cols.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS fuel_kind text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS fertilizer_kind text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS chemical_kind text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS yield_lines jsonb`;
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name IN ('fuel_kind','fertilizer_kind','chemical_kind','yield_lines') ORDER BY 1`;
  console.log("suppliers cols:", cols.map((c) => c.column_name).join(", "));
})();
