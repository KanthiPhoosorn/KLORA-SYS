// Seed Neon with the existing data/*.json. Run after `npm run db:push` creates the tables:
//   npm run db:seed
// Idempotent: it clears each table before inserting, so re-running is safe.

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set in .env.local");

const sql = neon(url);
const db = drizzle(sql, { schema });

function load<T>(name: string): T[] {
  try {
    const raw = readFileSync(path.join(process.cwd(), "data", name), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const suppliers = load<typeof schema.suppliers.$inferInsert>("suppliers.json");
  const users = load<typeof schema.users.$inferInsert>("users.json");
  const batches = load<Record<string, unknown>>("batches.json").map((b) => ({
    ...b,
    basketIds: Array.isArray(b.basketIds) ? b.basketIds : [],
  })) as (typeof schema.batches.$inferInsert)[];
  const members = load<typeof schema.members.$inferInsert>("members.json");
  const invites = load<typeof schema.invites.$inferInsert>("invites.json");
  const notifications = load<typeof schema.notifications.$inferInsert>("notifications.json");
  const prints = load<typeof schema.prints.$inferInsert>("prints.json");

  // Clear (child-ish tables first — no FKs defined, but keep a sensible order).
  await db.delete(schema.prints);
  await db.delete(schema.invites);
  await db.delete(schema.members);
  await db.delete(schema.notifications);
  await db.delete(schema.batches);
  await db.delete(schema.users);
  await db.delete(schema.suppliers);
  await db.delete(schema.otp);

  if (suppliers.length) await db.insert(schema.suppliers).values(suppliers);
  if (users.length) await db.insert(schema.users).values(users);
  if (batches.length) await db.insert(schema.batches).values(batches);
  if (members.length) await db.insert(schema.members).values(members);
  if (invites.length) await db.insert(schema.invites).values(invites);
  if (notifications.length) await db.insert(schema.notifications).values(notifications);
  if (prints.length) await db.insert(schema.prints).values(prints);

  console.log(
    `Seeded: ${suppliers.length} suppliers, ${users.length} users, ${batches.length} batches, ` +
      `${members.length} members, ${invites.length} invites, ${notifications.length} notifications, ${prints.length} prints`,
  );
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
