// One-off migration (9 Oct 2026): cache for recipient-address geocoding (src/lib/geocode.ts).
//   npx tsx --env-file=.env.local scripts/add-geocode-cache.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`CREATE TABLE IF NOT EXISTS geocode_cache (q text PRIMARY KEY, lat double precision, lng double precision, precision text, label text, created_at text NOT NULL)`;
  console.log("geocode_cache ready");
})();
