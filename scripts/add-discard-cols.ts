// One-off migration: add the nullable discard columns to batches (additive, idempotent).
// Records logistics throughput per round: forwarded (ส่งต่อ) + discarded (คัดทิ้ง); received = flowerCount.
//   npx tsx scripts/add-discard-cols.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set in .env.local");
const sql = neon(url);

async function main() {
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS forwarded_count integer`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS discarded_count integer`;
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name IN ('forwarded_count', 'discarded_count')
    ORDER BY column_name`;
  console.log("batches discard columns ensured:", cols.map((c) => c.column_name).join(", "));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
