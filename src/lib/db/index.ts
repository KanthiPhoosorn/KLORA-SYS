// Neon (serverless HTTP) + Drizzle client. One instance per module load, which is the
// right pattern for Vercel serverless functions (neon-http is stateless — no pool to leak).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (local) or the Vercel project env (production).",
  );
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
export { schema };
