# Duevance — Get paid. Move forward.

Invoice follow-up SaaS: track unpaid invoices, prepare Friendly / Firm / Final reminders, open them in email or WhatsApp, and keep an honest activity history.
Stack: Next.js 15 (App Router) · TypeScript · Supabase (Postgres, Auth, RLS) · Razorpay Subscriptions (INR and USD).

## Verification status

| Area | Status |
|---|---|
| Schema, RLS isolation, free-plan trigger, constraints, webhook claim function | **Tested**: 24 tests on a real Postgres engine (PGlite) |
| Dates/timezones, money, CSV, reminder URLs, plan logic, Razorpay signature checks, webhook idempotency, password and redirect rules | **Tested**: 32 unit tests |
| Typecheck, lint, production build | **Passing** |
| Built-server smoke test (public pages, auth redirects, bad-signature webhook = 401) | **Passing** |
| Sign-up / sign-in / reset against a real Supabase project | **Not tested** (needs your project) |
| Razorpay checkout, webhooks, INR and USD plans | **Not tested** (needs your Razorpay account) |
| Hero animation, mobile layout, accessibility audit in a real browser | **Not tested** (no browser available when built) |

Complete the launch checklist at the bottom before taking real payments.

## Run locally
```bash
npm install
cp .env.example .env.local     # fill in values (no quotes, no trailing slash)
npm run dev                    # http://localhost:3000
npm run check                  # typecheck + lint + tests
npm run build && npm start     # production build
```

## Supabase setup
1. Create a project. In **SQL Editor** run `supabase/migrations/0001…0003` in order (or `supabase db push`).
2. **Authentication → Providers → Email**: keep Email enabled. Decide on **Confirm email**:
   - ON (recommended for production): new users must click a confirmation link before signing in.
   - OFF: users are signed in immediately after sign-up (good for local testing).
3. **Authentication → URL Configuration**: Site URL = `NEXT_PUBLIC_APP_URL`. Redirect URLs: add `…/auth/callback` and `…/auth/recovery` (or `NEXT_PUBLIC_APP_URL/**`).
4. **Email templates** (so links also work when opened on another device), set:
   - Confirm signup: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
   - Reset password: `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery`
5. **Authentication → Policies/Sign In**: set minimum password length to 8 or more and enable leaked-password protection if your plan has it. The app already enforces 8–72 characters and rejects common passwords.
6. Configure custom SMTP for production; the built-in sender is heavily rate limited.

Accounts use email + password. Passwords are handled by Supabase Auth (hashed); Duevance never stores them. Forgot-password uses an emailed one-time link. Changing a password and deleting an account both re-check the current password.

Design points: RLS on every table; invoices unique per user on a lower-cased invoice number (retry-safe imports); `sent_at` only on `marked_sent`; the 10-active-invoice Free limit is a database trigger; `subscriptions` and `webhook_events` are writable only by the service role.

## Razorpay setup (INR and USD)
One Razorpay account, two monthly plans. India (billing country IN) pays INR; every other country pays USD.
1. Dashboard → Account & Settings → API Keys → `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (use Test mode first).
2. Subscriptions → Plans → create two monthly plans: **INR 999** → `RAZORPAY_PLAN_ID_INR`, **USD 19** → `RAZORPAY_PLAN_ID_USD`. The amount charged is the amount on the plan; `PRO_PRICE_INR` / `PRO_PRICE_USD` only control what Duevance displays, so keep them equal.
3. **International payments:** USD plans and non-Indian cards require international payments to be enabled on your Razorpay account (Account & Settings → Payment methods / International), which Razorpay approves separately and may not offer for every business type. Ask Razorpay support to confirm that **recurring/subscription payments in USD** are enabled for you. Duevance cannot work around this.
4. Webhooks → add `https://YOUR_DOMAIN/api/webhooks/razorpay`, set a secret → `RAZORPAY_WEBHOOK_SECRET`, enable all `subscription.*` events.
5. Go live: switch to live keys, live plans and the live webhook, and update the env vars.

Access is never granted from the browser. Checkout creates a `pending` row server-side; the webhook is accepted only after Razorpay's HMAC signature check; the event only names the subscription, whose state is then re-read from Razorpay's API; each event ID is claimed atomically so replays are ignored and failed events can retry. "Refresh status" on the Billing page does the same provider-side sync.

## Deploy (Vercel config included)
Set every variable from `.env.example`; keep `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_KEY_SECRET` server-side only; set `NEXT_PUBLIC_APP_URL` to the final https URL; register the webhook URL. Check current Vercel/Supabase plan limits and commercial-use terms before launch.

## Launch checklist
- [ ] Migrations applied; auth redirect URLs, email templates and SMTP configured
- [ ] Sign up two accounts; confirm neither can see the other's invoices
- [ ] Sign in, sign out, wrong password, forgot/reset password, change password
- [ ] Free limit: 10 invoices OK, 11th refused; CSV imported twice creates no duplicates
- [ ] Razorpay test mode, INR: subscribe, webhook activates Pro, cancel keeps access until period end, failed payment
- [ ] Razorpay test mode, USD: same lifecycle (requires international payments enabled)
- [ ] Replay a webhook from the Razorpay dashboard; it must be ignored as a duplicate
- [ ] Download my data; delete a test account (password required)
- [ ] Review Privacy and Terms with a lawyer; set `NEXT_PUBLIC_SUPPORT_EMAIL`
- [ ] Browser-test the hero animation, mobile layouts and accessibility (Lighthouse/axe)
- [ ] Switch Razorpay to live and complete one small real subscription

## Known limitations
- Dashboard aggregates up to 2,000 open invoices per load.
- Imported rows marked `paid` get the import time as `paid_at`.
- No automatic sending by design. Overdue is evaluated in the user's timezone at page load.
- Standalone wordmark SVGs use live text (Bricolage Grotesque), not outlines; favicon is SVG only.
- `npm audit` flags a postcss copy bundled in Next 15.5; the fix is a breaking Next upgrade, so review before launch.
- Existing PayPal rows (if any) are ignored: PayPal support was removed.
