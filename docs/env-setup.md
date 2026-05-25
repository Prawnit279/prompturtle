# Environment Variable Setup

## Backend — Railway

Set these in Railway → Project → Variables:

| Variable | Value source |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `DATABASE_URL` | Supabase dashboard → Connect → Pooler (port 6543) |
| `DIRECT_URL` | Supabase dashboard → Connect → Direct (port 5432) |
| `CLERK_SECRET_KEY` | clerk.com → API Keys (secret key, `sk_live_*` for prod) |
| `CLERK_PUBLISHABLE_KEY` | clerk.com → API Keys (publishable key, `pk_live_*` for prod) |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys (LIVE for prod) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → [endpoint] → Signing secret |
| `CLERK_WEBHOOK_SECRET` | Clerk → Webhooks → [endpoint] → Signing secret |
| `RESEND_API_KEY` | resend.com → API Keys |
| `FRONTEND_URL` | Exact Vercel deployment URL, no trailing slash (e.g. `https://progue.ai`) |
| `NODE_ENV` | `production` |
| `PORT` | `3001` (set in railway.toml — can omit from Railway dashboard) |
| `STRIPE_PRICE_STARTER` | Output of `npx tsx scripts/seed-stripe-prices.ts` (LIVE mode) |
| `STRIPE_PRICE_GROWTH` | Output of `npx tsx scripts/seed-stripe-prices.ts` (LIVE mode) |
| `STRIPE_PRICE_ENTERPRISE` | Output of `npx tsx scripts/seed-stripe-prices.ts` (LIVE mode) |

## Frontend — Vercel

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Value source |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | clerk.com → API Keys (publishable key, `pk_live_*`) |
| `VITE_STRIPE_PRICE_STARTER` | Same as backend `STRIPE_PRICE_STARTER` |
| `VITE_STRIPE_PRICE_GROWTH` | Same as backend `STRIPE_PRICE_GROWTH` |
| `VITE_STRIPE_PRICE_ENTERPRISE` | Same as backend `STRIPE_PRICE_ENTERPRISE` |

> **API routing note:** The frontend uses relative `/api/*` paths via Vite proxy in development.
> In production on Vercel, `/api/*` requests must reach the Railway backend. Configure this
> in Vercel's dashboard under Project → Settings → Functions → Rewrites, or add a reverse
> proxy in `vercel.json` pointing `/api/*` at your Railway URL.

## GitHub Actions secrets required for CI/CD

| Secret | Purpose |
|---|---|
| `RAILWAY_TOKEN` | Railway dashboard → Account Settings → API Tokens |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Output of `vercel link` in `apps/frontend/` |
| `VERCEL_PROJECT_ID` | Output of `vercel link` in `apps/frontend/` |
| `DATABASE_URL` | Supabase (CI can use a separate test Supabase project) |
| `DIRECT_URL` | Supabase direct URL (same project) |
| `ANTHROPIC_API_KEY` | Needed for integration tests that call the AI layer |
| `CLERK_SECRET_KEY` | Clerk test instance key for CI |
| `CLERK_TEST_USER_EMAIL` | Pre-provisioned Clerk test user |
| `CLERK_TEST_USER_PASSWORD` | Pre-provisioned Clerk test user |
| `E2E_TEST_API_KEY` | API key for the test tenant |

## Pre-deploy checklist (human must verify before triggering deploy)

- [ ] Supabase project is **not** paused (check dashboard → Project Settings)
- [ ] Production DB migrations applied: run `scripts/migrate-production.sh`
- [ ] Stripe Customer Portal enabled at dashboard.stripe.com/settings/billing/portal (LIVE mode)
- [ ] Stripe seed script run in LIVE mode: `STRIPE_SECRET_KEY=sk_live_... npx tsx apps/backend/scripts/seed-stripe-prices.ts`
- [ ] Clerk **production** instance configured (separate from dev/test instance)
- [ ] Clerk webhook endpoint registered pointing at Railway URL:
      `https://api.progue.ai/api/webhooks/clerk` — events: `user.created`, `organization.created`
- [ ] Stripe webhook endpoint registered pointing at Railway URL:
      `https://api.progue.ai/api/webhooks/stripe` — events: `checkout.session.completed`, `customer.subscription.*`
- [ ] `FRONTEND_URL` set to exact Vercel URL (no trailing slash) — CORS depends on this
- [ ] All GitHub Actions secrets populated (see table above)
- [ ] DNS: custom domain pointed to Vercel (if using `progue.ai`)
- [ ] Railway and Vercel projects linked to this GitHub repo (for automatic deploys)

## Post-deploy smoke test

After deploying, verify these endpoints manually:

```bash
# Backend health
curl https://api.progue.ai/api/health

# Frontend reachable
curl -I https://progue.ai

# CORS header correct
curl -H "Origin: https://progue.ai" https://api.progue.ai/api/health
```
