// One-off migration: add the nullable `phone` column to users (additive, idempotent).
//   npx tsx scripts/add-phone-col.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set in .env.local");
const sql = neon(url);

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`;
  console.log("users.phone column ensured.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
