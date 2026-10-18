// Doc "Logistic", 18 Oct 2026: fruit and vegetables get an optional จำนวน (count) next to their weight.
// Adds two nullable columns to batches; idempotent.
//   npx tsx --env-file=.env.local scripts/add-piece-count.ts
import { neon } from "@neondatabase/serverless";

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS piece_count integer`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS piece_unit text`;
  console.log(await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'batches' AND column_name IN ('piece_count', 'piece_unit') ORDER BY column_name`);
})();
