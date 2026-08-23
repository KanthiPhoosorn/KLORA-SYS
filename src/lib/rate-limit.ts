// Serverless-safe fixed-window rate limiter backed by Postgres (see db/schema rateLimits).
// A single atomic upsert per hit avoids the read-then-write race that lets bursts through.

import { sql, lt } from "drizzle-orm";
import { db } from "./db";
import { rateLimits } from "./db/schema";
import { NextResponse } from "next/server";

// Client IP on Vercel. x-real-ip is set by the platform to the true peer and is NOT
// client-forgeable; only fall back to the LAST x-forwarded-for entry (the hop Vercel
// appended) — never the first, which a caller can spoof to rotate buckets.
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}

export interface RateResult {
  allowed: boolean;
  retryAfter: number; // seconds until the window resets (0 when allowed)
}

export async function rateLimit(key: string, max: number, windowMs: number): Promise<RateResult> {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Atomic: insert a fresh window, or (on conflict) reset if the window expired else count+1.
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} < ${cutoff} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${cutoff} THEN ${now} ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning();

  // Opportunistic prune so the table can't grow unbounded (fires on ~2% of calls).
  if (Math.random() < 0.02) {
    try {
      await db.delete(rateLimits).where(lt(rateLimits.windowStart, now - 24 * 60 * 60 * 1000));
    } catch {
      /* prune is best-effort */
    }
  }

  const count = row?.count ?? 1;
  const windowStart = row?.windowStart ?? now;
  const allowed = count <= max;
  const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
  return { allowed, retryAfter };
}

// Standard 429 response with a Retry-After header and a Thai message.
export function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: "มีการพยายามมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
