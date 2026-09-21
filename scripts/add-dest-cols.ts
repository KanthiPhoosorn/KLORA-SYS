// One-off migration (21 Sep 2026): destination address + GPS on a round.
//   npx tsx --env-file=.env.local scripts/add-dest-cols.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS destination_address text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS dest_lat double precision`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS dest_lng double precision`;
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'batches' AND column_name IN ('destination_address','dest_lat','dest_lng') ORDER BY 1`;
  console.log("batches cols:", cols.map((c) => c.column_name).join(", "));
})();
