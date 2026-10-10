// One-off migration (10 Oct 2026, Thai Post doc §15): satisfaction ratings from the QR page — a visitor
// gives the farm (สวน) and the carrier (การขนส่ง) 1–5 stars; the averages of that farm and that carrier
// show on the QR page. Idempotent.
//   ratings: one row per (lot, device); carrier_key = the carrier org (CID) handling the lot, else its name
//   prints.org_code: the carrier org that printed the QR (who handles an unbound farm's lot)
//   npx tsx --env-file=.env.local scripts/add-ratings.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`CREATE TABLE IF NOT EXISTS ratings (
    id text PRIMARY KEY,
    batch_id text NOT NULL REFERENCES batches(id) ON DELETE CASCADE ON UPDATE CASCADE,
    supplier_id text NOT NULL,
    carrier_key text,
    carrier_name text,
    farm_stars integer,
    transport_stars integer,
    comment text,
    rater text NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    UNIQUE (batch_id, rater)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS ratings_supplier ON ratings (supplier_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ratings_carrier ON ratings (carrier_key)`;
  await sql`ALTER TABLE prints ADD COLUMN IF NOT EXISTS org_code text`;
  console.log("ratings: ok");
})();
