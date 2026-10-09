// One-off migration (9 Oct 2026, Thai Post doc tab) — every column the October round needs:
//  batches: expected_age_days (อายุหลังตัดที่คาดการณ์), tracking_no (เลขพัสดุ), awb_no (Air Waybill),
//           cancelled_at / cancel_reason / cancelled_by (ยกเลิกรายการ — soft cancel)
//  batch_events: who changed what on a lot (ประวัติการแก้ไข)
//  users: avatar (profile picture, small data URL), label_size (preferred sticker size)
//   npx tsx --env-file=.env.local scripts/add-oct-cols.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS expected_age_days integer`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS tracking_no text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS awb_no text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS cancelled_at text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS cancel_reason text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS cancelled_by text`;
  await sql`CREATE TABLE IF NOT EXISTS batch_events (
    id text PRIMARY KEY,
    batch_id text NOT NULL,
    at text NOT NULL,
    actor_id text,
    actor_name text,
    action text NOT NULL,
    detail jsonb
  )`;
  await sql`CREATE INDEX IF NOT EXISTS batch_events_batch ON batch_events (batch_id, at)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS label_size text`;
  const cols = await sql`SELECT table_name, column_name FROM information_schema.columns WHERE (table_name = 'batches' AND column_name IN ('expected_age_days','tracking_no','awb_no','cancelled_at','cancel_reason','cancelled_by')) OR (table_name = 'users' AND column_name IN ('avatar','label_size')) OR table_name = 'batch_events' ORDER BY 1, 2`;
  console.log(cols.map((r) => `${r.table_name}.${r.column_name}`).join(", "));
})();
