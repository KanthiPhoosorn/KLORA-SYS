// One-off migration (10 Oct 2026): carrier sign-up links. A carrier (logistic org, CID-…) creates a link on
// /logistic/incoming and sends it to its farms; a farm that signs up through it — or attaches an existing
// account — ships only with that carrier. Idempotent.
//   carrier_links: one row per link (token in the URL /c/<token>)
//   suppliers.carrier_org / carrier_company / carrier_branch / carrier_link: who the farm is bound to
//   batches.carrier_org: the carrier a lot was created for (the lock applies to lots made after binding)
//   npx tsx --env-file=.env.local scripts/add-carrier-links.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`CREATE TABLE IF NOT EXISTS carrier_links (
    token text PRIMARY KEY,
    org_code text NOT NULL,
    company text,
    carrier_key text NOT NULL,
    branch text,
    created_by text,
    created_at text NOT NULL,
    revoked_at text,
    uses integer NOT NULL DEFAULT 0
  )`;
  await sql`CREATE INDEX IF NOT EXISTS carrier_links_org ON carrier_links (org_code)`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS carrier_org text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS carrier_company text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS carrier_branch text`;
  await sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS carrier_link text`;
  await sql`ALTER TABLE batches ADD COLUMN IF NOT EXISTS carrier_org text`;
  console.log("carrier links: ok");
})();
