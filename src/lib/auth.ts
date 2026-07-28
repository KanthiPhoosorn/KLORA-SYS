// Authentication for the SUP (farm) role. Server-only — do NOT import from a client
// component. Real password hashing (scrypt) + a tamper-proof signed session cookie.
// No external DB: users live in data/users.json (see store.ts).

import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUsers } from "./store";
import type { User } from "./types";

const SECRET =
  process.env.KLORA_SESSION_SECRET || "klora-dev-secret-change-in-production";
const COOKIE = "klora_session";
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

// --- Password hashing -----------------------------------------------------

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): boolean {
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

// --- Signed session token (payload.signature) -----------------------------

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function makeToken(userId: string): string {
  const exp = Date.now() + MAX_AGE_S * 1000;
  const payload = `${userId}:${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function verifyToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const payload = Buffer.from(b64, "base64url").toString();
  // Constant-time-ish signature check.
  const expected = sign(payload);
  if (
    expected.length !== sig.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  ) {
    return null;
  }
  const [userId, expStr] = payload.split(":");
  if (!userId || Number(expStr) < Date.now()) return null;
  return userId;
}

// --- Cookie helpers (call from route handlers / server actions) -----------

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

// --- Current user ---------------------------------------------------------

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const userId = verifyToken(token);
  if (!userId) return null;
  const users = await getUsers();
  return users.find((u) => u.id === userId) ?? null;
}

// Guard for SUP-only server components: returns the user or redirects to /login.
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
