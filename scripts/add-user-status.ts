// One-off migration: per-account active/suspended flag (KYN can suspend logistic/KYN logins).
//   npx tsx --env-file=.env.local scripts/add-user-status.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status text`;
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`;
  console.log(cols.map((c) => c.column_name).join(", "));
})();
