# QA harness

Run against a local dev server (`PORT=3123 npm run dev`) with `.env.local` loaded.
`npm i puppeteer-core --no-save` first for the browser scripts (Chrome at the default Windows path).

| script | what it proves |
|---|---|
| `crawl.ts` | every page route × every role (anon / supplier / logistic / kyn): HTTP status, redirect target, page errors, console errors, failed `/api/*` calls |
| `flows.ts` | 71 write/auth checks with throw-away `*@klora-qa.test` accounts: register → login → batch → transport → status → discard → prints; invites → join; forgot → OTP → reset; change-password; KYN suspend; every guarded endpoint refuses without a session; cleans up after itself |
| `google.ts` | Google sign-in against a mock Google (start the server with `GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test GOOGLE_TOKEN_URL=http://localhost:3999/token GOOGLE_USERINFO_URL=http://localhost:3999/userinfo`) |
| `free-plan.ts` | renders the free-plan (Lock) supplier screens with a throw-away account |

```
npx tsx --env-file=.env.local scripts/qa/flows.ts
QA_BATCH=BAT-2026-0001 npx tsx --env-file=.env.local scripts/qa/crawl.ts
```
