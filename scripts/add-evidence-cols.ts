// Evidence pass (9 Nov 2026, docs/research): harvest photos + repeated-photo check on pack_photos, and the
// carrier's receipt scan + who entered the tracking number on batches. Additive, nullable, idempotent.
//   npx tsx --env-file=.env.local scripts/add-evidence-cols.ts
import { neon } from "@neondatabase/serverless";

(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE pack_photos ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'pack'`;
  await sql`ALTER TABLE pack_photos ADD COLUMN IF NOT EXISTS src_hash text`;
  await sql`CREATE INDEX IF NOT EXISTS pack_photos_src_hash_idx ON pack_photos (src_hash) WHERE src_hash IS NOT NULL`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS received_at text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS received_by text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS received_condition text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS received_note text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS tracking_by text`;
  console.log(await sql`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE (table_name = 'pack_photos' AND column_name IN ('stage', 'src_hash'))
       OR (table_name = 'batches' AND column_name IN ('received_at', 'received_by', 'received_condition', 'received_note', 'tracking_by'))
    ORDER BY table_name, column_name`);
  console.log(await sql`SELECT stage, count(*)::int n FROM pack_photos GROUP BY stage`);
})().catch((e) => { console.error(String(e?.message ?? e).replace(/postgres(ql)?:[^ ]+/g, "[url]")); process.exit(1); });
