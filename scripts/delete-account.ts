// Ops utility: hard-delete an account (user + its supplier + batches + otp) by email.
//   npx tsx scripts/delete-account.ts someone@example.com
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set in .env.local");
const email = process.argv[2];
if (!email) throw new Error("usage: tsx scripts/delete-account.ts <email>");

const sql = neon(url);

async function main() {
  const users = (await sql`SELECT id, supplier_id FROM users WHERE lower(email) = lower(${email})`) as {
    id: string;
    supplier_id: string | null;
  }[];
  for (const u of users) {
    if (u.supplier_id) {
      await sql`DELETE FROM batches WHERE supplier_id = ${u.supplier_id}`;
      await sql`DELETE FROM suppliers WHERE id = ${u.supplier_id}`;
    }
    await sql`DELETE FROM users WHERE id = ${u.id}`;
  }
  await sql`DELETE FROM otp WHERE lower(email) = lower(${email})`;
  console.log(`Deleted ${users.length} account(s) for ${email}.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
