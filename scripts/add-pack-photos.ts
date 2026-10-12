// One-off migration (12 Oct 2026): photos taken while packing a round, to confirm the packing date + time.
// Uploaded from the round form before the lot exists (batch_id NULL = not yet saved), linked to the LOT on
// save; deleted with their lot. taken_at = when the camera took it (EXIF, else the file time), uploaded_at =
// server time; a photo is "verified" when the two are within 24 h (lib/pack-photo). Idempotent.
//   npx tsx --env-file=.env.local scripts/add-pack-photos.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`CREATE TABLE IF NOT EXISTS pack_photos (
    id text PRIMARY KEY,
    supplier_id text NOT NULL,
    batch_id text REFERENCES batches(id) ON DELETE CASCADE ON UPDATE CASCADE,
    mime text NOT NULL,
    size integer NOT NULL,
    data text NOT NULL,
    taken_at text,
    taken_src text NOT NULL,
    uploaded_at text NOT NULL,
    created_by text
  )`;
  await sql`CREATE INDEX IF NOT EXISTS pack_photos_batch ON pack_photos (batch_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pack_photos_supplier ON pack_photos (supplier_id)`;
  console.log("pack photos: ok");
})();
