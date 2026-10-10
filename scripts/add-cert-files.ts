// One-off migration (10 Oct 2026, Thai Post doc §17 / meeting 11-09-2026): certificate attachments.
// A farm attaches a PDF / JPG / PNG (≤ 2 MB) to each ใบรับรองมาตรฐาน; only the farm and KYN can open it.
// Kept out of the suppliers row (certifications jsonb holds just the file id + name). Idempotent.
//   npx tsx --env-file=.env.local scripts/add-cert-files.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`CREATE TABLE IF NOT EXISTS cert_files (
    id text PRIMARY KEY,
    supplier_id text NOT NULL,
    name text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    data text NOT NULL,
    uploaded_by text,
    created_at text NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS cert_files_supplier ON cert_files (supplier_id)`;
  console.log("cert files: ok");
})();
