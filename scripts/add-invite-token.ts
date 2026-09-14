// One-off migration: secret join token per invite (links in invite emails).
//   npx tsx --env-file=.env.local scripts/add-invite-token.ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  await sql`ALTER TABLE invites ADD COLUMN IF NOT EXISTS token text`;
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'invites' ORDER BY ordinal_position`;
  console.log(cols.map((c) => c.column_name).join(", "));
  const residue = await sql`SELECT (SELECT count(*) FROM suppliers WHERE farm_name LIKE 'QA %') s, (SELECT count(*) FROM users WHERE email LIKE '%klora-qa.test') u, (SELECT count(*) FROM otp WHERE email LIKE '%klora-qa.test') o`;
  console.log("QA residue:", JSON.stringify(residue[0]));
})();
