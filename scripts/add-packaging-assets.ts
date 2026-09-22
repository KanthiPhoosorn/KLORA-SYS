// One-off migration (22 Sep 2026): registry of reusable packaging (บรรจุภัณฑ์หมุนเวียน) — each
// physical basket/box gets a code (e.g. BSK-2026-00001) so its trips can be counted across rounds.
//   npx tsx --env-file=.env.local scripts/add-packaging-assets.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`CREATE TABLE IF NOT EXISTS packaging_assets (
    id text PRIMARY KEY,
    kind text NOT NULL,
    width double precision,
    length double precision,
    height double precision,
    design_life integer NOT NULL,
    prior_uses integer NOT NULL DEFAULT 0,
    owner_supplier_id text,
    owner_label text,
    created_at text NOT NULL,
    created_by text
  )`;
  const t = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'packaging_assets' ORDER BY ordinal_position`;
  console.log("packaging_assets:", t.map((r) => r.column_name).join(", "));
})();
