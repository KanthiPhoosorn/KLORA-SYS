// One-off migration (9 Oct 2026, Thai Post doc tab):
//  · suppliers.resource_lines — several fuel / fertilizer / chemical types per farm ("เพิ่มรายการ")
//  · custom_entries — every "อื่นๆ (ระบุ)" a user types, queued for KYN to confirm (and price in CO₂e)
//   npx tsx --env-file=.env.local scripts/add-resource-lines.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS resource_lines jsonb`;
  await sql`CREATE TABLE IF NOT EXISTS custom_entries (
    id text PRIMARY KEY,
    field text NOT NULL,
    value text NOT NULL,
    detail jsonb,
    supplier_id text,
    user_id text,
    batch_id text,
    uses integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'pending',
    ef double precision,
    note text,
    created_at text NOT NULL,
    reviewed_at text,
    reviewed_by text
  )`;
  await sql`CREATE INDEX IF NOT EXISTS custom_entries_field_value ON custom_entries (field, lower(value))`;
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'custom_entries' ORDER BY ordinal_position`;
  console.log("custom_entries:", c.map((r) => r.column_name).join(", "));
  console.log("suppliers.resource_lines:", (await sql`SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'resource_lines'`)[0].n === 1);
})();
