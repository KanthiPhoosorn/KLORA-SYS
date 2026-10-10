// One-off migration (10 Oct 2026, QR page per the Super App mockup): public farm / product photos.
//   media: one image (JPEG/PNG/WebP, shrunk in the browser) served at /api/media/<id> — the QR page is public
//   suppliers.product_photos: { [product type]: "/api/media/<id>" } — the hero photo of a lot's product
//   (suppliers.photo_url already exists: the farm photo, now "/api/media/<id>")
//   npx tsx --env-file=.env.local scripts/add-media.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`CREATE TABLE IF NOT EXISTS media (
    id text PRIMARY KEY,
    supplier_id text NOT NULL,
    kind text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    data text NOT NULL,
    created_at text NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS media_supplier ON media (supplier_id)`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS product_photos jsonb`;
  console.log("media: ok");
})();
