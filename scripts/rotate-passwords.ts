// Rotate the seeded accounts (farm/logistic/kyn) off the shared "password123" to strong
// random passwords. Updates the live DB + data/users.json (so re-seed stays consistent),
// self-verifies each new hash, and writes the plaintext creds to a gitignored local file.
//   npx tsx scripts/rotate-passwords.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { randomBytes, scryptSync } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set in .env.local");
const sql = neon(url);

const TARGETS = ["farm", "logistic", "kyn"];

// Matches src/lib/auth.ts hashPassword exactly.
function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}
// Readable-ish strong password: 14 chars, no ambiguous glyphs.
function genPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = randomBytes(14);
  let out = "";
  for (let i = 0; i < 14; i++) out += alphabet[b[i] % alphabet.length];
  return out;
}

async function main() {
  const usersPath = path.join(process.cwd(), "data", "users.json");
  const users = JSON.parse(readFileSync(usersPath, "utf8")) as { username: string; passwordHash: string; salt: string }[];
  const creds: { username: string; password: string }[] = [];

  for (const uname of TARGETS) {
    const pw = genPassword();
    const { hash, salt } = hashPassword(pw);
    // self-check: the app's verifyPassword recomputes scrypt(pw, salt) and compares to hash.
    if (scryptSync(pw, salt, 64).toString("hex") !== hash) throw new Error(`hash self-check failed for ${uname}`);
    const res = await sql`UPDATE users SET password_hash = ${hash}, salt = ${salt} WHERE username = ${uname} RETURNING id`;
    if (!res.length) throw new Error(`no user '${uname}' in DB`);
    const u = users.find((x) => x.username === uname);
    if (u) { u.passwordHash = hash; u.salt = salt; }
    creds.push({ username: uname, password: pw });
  }

  writeFileSync(usersPath, JSON.stringify(users, null, 2) + "\n", "utf8");
  const body =
    `KLORA login credentials — rotated ${new Date().toISOString().slice(0, 10)} — KEEP PRIVATE\n\n` +
    creds.map((c) => `${c.username.padEnd(10)} ${c.password}`).join("\n") + "\n";
  writeFileSync(path.join(process.cwd(), "CREDENTIALS.local.txt"), body, "utf8");

  console.log("Rotated:", TARGETS.join(", "));
  console.log("New credentials written to CREDENTIALS.local.txt (gitignored). password123 is now dead.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
