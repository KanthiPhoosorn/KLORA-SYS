// Ops utility: wipe the rate_limits table (e.g. after load-testing, or to unblock an IP).
//   npx tsx scripts/clear-rate-limits.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set in .env.local");

const sql = neon(url);

async function main() {
  await sql`DELETE FROM rate_limits`;
  console.log("Cleared rate_limits.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
