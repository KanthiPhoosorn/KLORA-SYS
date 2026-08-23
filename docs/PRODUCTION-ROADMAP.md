# KLORA — Production Roadmap

Status as of 2026-08-24. Live at **https://klora-two.vercel.app** (Vercel + Neon Postgres).

## Done
- **Data layer:** Postgres (Neon) via Drizzle; `store.ts` SQL-backed, seeded, live-tested.
- **Deploy:** Vercel, auto-deploy on push to `main`; `DATABASE_URL` + `KLORA_SESSION_SECRET` set.
- **Auth:** scrypt + HMAC-signed httpOnly cookie; role guards; per-role portals.
- **Tier-1 security:** Postgres-backed rate limiting (login by IP+account, register, forgot),
  spoof-safe IP keying, real reset email via Resend with graceful fallback, OTP no longer leaked
  in production.

## Tier-1 finish (small, needs one action each)
| Item | What | Action needed |
|---|---|---|
| Working password reset | Done; Resend key set — delivers only to the Resend owner (no domain yet) | To email ANY user without buying a domain: **Gmail SMTP fallback** — add a nodemailer path to `email.ts`, set `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google App Password) in Vercel. Sends from the personal Gmail, ~500/day, good deliverability. OR verify a real domain in Resend later for branded `noreply@domain`. |
| DB/function latency | Pin Vercel functions to the Neon region | Add `vercel.json` `{ "regions": ["sin1"] }` (or the code matching your Neon region). |
| Demo lockdown | Rotate seeded passwords, drop the demo-cred hint from the login page | Product decision (deferred by owner). |

## Tier-2 — when it takes real users / money

### 1. Billing for Pro (freemium is a fake toggle today)
- **Where it hooks:** `ProLock` "ดูแพ็กเกจและอัปเกรด" button → checkout; on success set `supplier.plan = "pro"`.
- **Provider:** Stripe (global) or **Omise / 2C2P** (Thai cards + PromptPay) for a TH audience.
- **Build:** checkout session route → webhook (`/api/billing/webhook`) that flips `plan` in Neon;
  add `plan` history/`subscriptionId` columns; guard the webhook with the provider signature.
- **Effort:** M–L (needs provider account + webhook testing).

### 2. PDPA compliance (Thai Personal Data Protection Act)
- The app stores personal data (names, phone, LINE, email, addresses, GPS). PDPA applies.
- **Needed:** a **privacy notice** (purpose, retention, rights, contact of the data controller),
  a **consent** checkpoint at register, a data-subject request path (export/delete an account),
  and a retention policy. Legal review required — do **not** ship a generated policy as final.
- **Build hook:** `/privacy` page + a consent checkbox on the register wizard + an account-delete
  endpoint (hard-delete user + supplier + cascade). **Effort:** M (legal review is the long pole).

### 3. Error monitoring + logging
- **Sentry** (`@sentry/nextjs`) — captures server/client errors with source maps. Needs a DSN.
- Add a global `app/error.tsx` + `app/global-error.tsx` boundary (currently none).
- **Effort:** S (mostly account + DSN + wizard).

### 4. Preview-deploy DB isolation
- Vercel **Preview** currently shares the **production** Neon DB (env set for Production+Preview).
- Fix: create a **Neon branch** and set a separate `DATABASE_URL` for the Vercel *Preview*
  environment only, so PR/branch deploys can't mutate prod data. **Effort:** S (config only).

### 5. Backups & ops
- Neon has point-in-time restore on paid tiers; confirm the retention window fits.
- Add a scheduled `pg_dump` (or Neon branch snapshot) if a longer/offsite backup is required.
- Consider an IP allow-list on the Neon role for the app, and connection limits.

## Suggested order
Resend key → region pin → (before public launch) demo lockdown + PDPA notice+consent →
Sentry → Preview-DB branch → billing when monetizing.
