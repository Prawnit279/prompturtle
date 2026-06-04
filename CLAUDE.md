# CLAUDE.md — Prompturtle / Progue.ai

> **Auto-load this file at the start of every session.**  
> Product name in UI: **Progue** (wordmark: `progue.` with brand-purple dot `#5B3A82`)

---

## Project Overview

**Progue.ai** is a multi-tenant SaaS platform that provides AI-powered MCP (Model Context Protocol) servers for supply chain software teams. Vendors embed Progue's Context Engine into their SC products via REST API calls.

- **Monorepo root:** `~/Projects/prompturtle/`
- **Git remote:** `git@github.com:Prawnit279/prompturtle.git` — SSH only, never HTTPS
- **Package manager:** pnpm workspaces (use `npm` as fallback if pnpm unavailable)
- **Node version:** 20 (`.nvmrc`)
- **Supabase project ID:** `aowvybglokzbcuerlago`

### Production URLs & Hosting

| Surface | URL | Host |
|---|---|---|
| Marketing site | `https://progue.ai` | Vercel |
| Dashboard app | `https://app.progue.ai` | Vercel (same project, subdomain) |
| Backend API | `https://api.progue.ai` | Railway (US West, node@20) |
| DNS registrar | Domain.com | — |

- **Clerk production instance:** primary domain `progue.ai`, Frontend API `clerk.progue.ai`. Requires 5 CNAME records on Domain.com (clerk, accounts, clkmail, clk._domainkey, clk2._domainkey → `*.clerk.services`). All verified, SSL issued.
- **Clerk keys:** production publishable `pk_live_Y2xlcmsucHJvZ3VlLmFpJA`. Frontend (`VITE_CLERK_PUBLISHABLE_KEY` on Vercel) and backend (`CLERK_SECRET_KEY` = `sk_live_...` on Railway) MUST both be the production pair — mixing dev/prod keys breaks JWT verification.
- **Google OAuth:** Clerk production uses **custom credentials** (shared dev credentials do NOT work in production). Google Cloud project `progue-production`; redirect URI `https://clerk.progue.ai/v1/oauth_callback`, JS origin `https://progue.ai`.

---

## Monorepo Structure

```
prompturtle/
├── apps/
│   ├── backend/          Express + Prisma + Pino + Vitest
│   └── frontend/         Vite + React 18 + TypeScript + Clerk + Tailwind
├── packages/
│   ├── shared/           Shared enums/types (no build step — main: "./src/index.ts")
│   └── prompts/          Prompt templates
└── docs/
    ├── API.md            Full endpoint + tool reference
    ├── MCP_INTEGRATION.md Vendor embedding guide
    ├── VENDOR_GUIDE.md   Zero-to-first-call onboarding
    └── runbooks/
        └── stripe-webhook-rollback.md  (PR 5.3)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node 20, Express, TypeScript, Prisma 5, Pino logger |
| Database | Supabase PostgreSQL + pgvector (cosine similarity) |
| Auth | Clerk (JWT verification via `@clerk/clerk-sdk-node`) |
| AI | Anthropic SDK (`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim vectors) |
| Billing | Stripe |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, `@clerk/clerk-react` |
| Tests | Vitest + supertest (backend), tsc --noEmit (frontend) |
| CI | GitHub Actions |

---

## Design System — Progue Tokens

```css
--bg: #060B1A            /* Space blue background */
--surface: #0C1326
--surface-raised: #111A33
--border: rgba(150,170,210,0.10)
--border-strong: rgba(150,170,210,0.16)
--text: #EAE8F0
--text-2: #9590B0
--text-3: #5E5A7A
--brand: #5B3A82          /* Brand purple */
--success: #5BA88C
--warning: #C9A86A
--error: #C36B7A
--info: #3E6FA0
--sans: 'Geist', -apple-system, system-ui, sans-serif
--mono: 'Geist Mono', ui-monospace, monospace
```

**Rule:** All colors MUST reference CSS custom properties (`var(--brand)`), never hardcoded hex in TSX.

---

## Absolute Rules (NEVER violate)

1. **No `console.log`** — Pino logger only on backend (`import logger from './lib/logger.js'` — default export)
2. **No TypeScript `any`** without a `// justification:` comment on the same line
3. **No LangChain** — use Anthropic SDK directly
4. **All Claude API calls** MUST go through `lib/cost-tracker.ts` → `trackedCall()`
5. **Migrations: additive-only** — never drop or rename columns after first migration
6. **Raw key never stored** — SHA-256 hash only (`key_hash` field, prefix for display)
7. **SSH-only git** — `git@github.com:Prawnit279/prompturtle.git`
8. **Only make changes directly requested** — no extra features, abstractions, or files

---

## Backend Key Files

```
apps/backend/src/
├── app.ts                   Express app factory (no listen() — importable in tests)
├── index.ts                 Entry point (imports app.ts, calls app.listen)
├── lib/
│   ├── db.ts                Prisma clients: `prisma` (raw, no RLS) + `db` (RLS-extended)
│   ├── cost-tracker.ts      trackedCall() — ALL LLM calls must go through this
│   ├── logger.ts            Pino logger (DEFAULT EXPORT — import logger from './logger.js')
│   ├── audit.ts             writeAuditEvent(), queryAuditLog()
│   ├── approval.ts          checkAndRequestApproval(), recordDecision(), getPendingApprovals()
│   └── tenantContext.ts     AsyncLocalStorage for RLS
├── middleware/
│   ├── auth.ts              Clerk JWT → res.locals.tenantId + res.locals.userId
│   ├── requireTenant.ts     Guards: returns 401 if no tenantId/userId
│   └── withTenantContext.ts Bridges res.locals into AsyncLocalStorage
├── mcp/
│   ├── BaseMCPServer.ts     Abstract base: assertToolExists(), call() pipeline
│   ├── registry.ts          Global server registry (Map of slots)
│   ├── types.ts             ToolCallContext, ToolCallResult, ToolDefinition, GuardrailViolationError, NotImplementedError
│   └── servers/
│       ├── BolProcessorMCP.ts       3 tools: extract_bol_fields, validate_bol_data, flag_bol_discrepancies
│       ├── CarrierRatesMCP.ts       3 tools: get_carrier_rates, compare_carrier_options, recommend_carrier
│       ├── HtsClassifierMCP.ts      3 tools: classify_product, validate_classification, get_duty_rates
│       ├── CarbonTrackingMCP.ts     STUB (Phase 2) — throws NotImplementedError
│       ├── SupplierRiskMCP.ts       STUB (Phase 2) — throws NotImplementedError
│       └── schemas/
│           └── hts-classifier.schemas.ts
├── routes/
│   ├── docs.ts              GET /api/docs → OpenAPI 3.1 spec (public)
│   ├── keys.ts              GET/POST/DELETE /api/keys — API key management
│   ├── logs.ts              GET /api/logs — paginated tool call logs
│   └── usage.ts             GET /api/usage — aggregated cost/tokens by server
├── guardrails/
│   ├── GuardrailEngine.ts   enforce() — runs all registered rules
│   └── rules/
│       └── InputSchemaRule.ts  Zod schema validation per tool
└── data/
    ├── hts-ingest.ts        ingestHtsCodes() + searchHtsCodes() (pgvector cosine)
    └── hts-seed-data.ts     25 HTS code records
```

---

## Model Routing (fixed — not caller-configurable)

| Tool | Model |
|---|---|
| BOL: `extract_bol_fields` | `claude-sonnet-4-6` |
| BOL: `validate_bol_data` | `claude-haiku-4-5-20251001` |
| BOL: `flag_bol_discrepancies` | `claude-opus-4-6` |
| Carrier: `get_carrier_rates` | `claude-haiku-4-5-20251001` |
| Carrier: `compare_carrier_options` | `claude-sonnet-4-6` |
| Carrier: `recommend_carrier` | `claude-sonnet-4-6` |
| HTS: `classify_product` | `claude-opus-4-6` |
| HTS: `validate_classification` | `claude-haiku-4-5-20251001` |
| HTS: `get_duty_rates` | None (pure DB lookup) |

---

## Database — Prisma Schema Key Points

- `prisma` (from `lib/db.ts`) = raw PrismaClient, no RLS — used in MCP servers and seed scripts
- `db` (from `lib/db.ts`) = RLS-extended client — use for tenant-scoped operations
- All DB fields are **snake_case** in Prisma (e.g., `duty_rate`, `tenant_id`, `created_at`)
- `ApiKey.key_hash` = SHA-256 of raw key; `ApiKey.prefix` = first 12 chars (display only)
- `ApiKey.revoked_at` = nullable DateTime (null = active; non-null = revoked)

### Key Models

| Model | Table | Notes |
|---|---|---|
| `Tenant` | `tenants` | Has `tier`, `stripe_customer_id`, `api_key_hash` |
| `ApiKey` | `api_keys` | `key_hash` unique, `prefix` display, `revoked_at` soft-delete |
| `ToolCall` | `tool_calls` | `mcp_server`, `tool_name`, `model_used`, `latency_ms`, `success` |
| `AuditEvent` | `audit_events` | `action` (AuditAction enum), `entity_type`, `entity_id`, `payload` |
| `ApprovalRequest` | `approval_requests` | `trigger`, `status`, `context` (JSON), `expires_at` |
| `ApprovalDecision` | `approval_decisions` | `decided_by` (Clerk user-id), `decision`, `note` |
| `HtsCode` | `hts_codes` | `code`, `description`, `chapter`, `duty_rate` |
| `EmbeddingStore` | `embedding_store` | `namespace='hts-codes'`, `embedding vector(1536)` |
| `ProcessedWebhook` | `processed_webhooks` | Stripe idempotency guard — `stripe_event_id` unique |
| `GuardrailRule` | `guardrail_rules` | Per-tenant rule config |
| `BillingUsage` | `billing_usage` | Aggregated cost per period |

### Enums

```
TenantTier:      STARTER | GROWTH | ENTERPRISE
AuditAction:     CREATE | READ | UPDATE | DELETE | TOOL_CALL | AUTH_EVENT | GUARDRAIL_VIOLATION | APPROVAL_REQUESTED | APPROVAL_DECIDED
ApprovalStatus:  PENDING | APPROVED | REJECTED | ESCALATED | EXPIRED
ApprovalTrigger: HIGH_SHIPMENT_COST | LOW_HTS_CONFIDENCE | CARRIER_CHANGE_ON_PO
Phase2Feature:   CARBON_TRACKING | SUPPLIER_RISK  ← DO NOT REMOVE
```

---

## Supabase Setup

- **Project ID:** `aowvybglokzbcuerlago`
- **Region:** AWS US East 1
- **Migration tool:** `mcp__supabase__apply_migration` (MCP tool) — native PG connection broken on this machine (no IPv6, Supavisor auth issues)
- **Migrations applied:** 0006 (HTS embedding store), 0007 (approval workflow), 0008 (api_key prefix/revoked)
- **HTS embeddings:** 25 records seeded via Supabase MCP (pgvector, namespace='hts-codes')
- **pgvector:** `<=>` cosine distance, HNSW index, 1536-dim (OpenAI text-embedding-3-small)

---

## Shared Package (`packages/shared`)

- **No build step** — `main: "./src/index.ts"` in package.json
- Key exports: `TenantTier`, `TIER_LIMITS`, `ApprovalStatus`, `ApprovalTrigger`, `AuditAction`

---

## Tier Limits

| Tier | Price | Calls/min | Calls/month |
|---|---|---|---|
| STARTER | $149/mo | 10 | 1,000 |
| GROWTH | $599/mo | 60 | 10,000 |
| ENTERPRISE | $1,999/mo | 300 | 100,000 |

---

## Approval Workflow Thresholds

| Trigger | Condition |
|---|---|
| `HIGH_SHIPMENT_COST` | `shipmentCostUsd > 10,000` |
| `LOW_HTS_CONFIDENCE` | `htsConfidence < 0.70` |
| `CARRIER_CHANGE_ON_PO` | `previousCarrier !== newCarrier` |

---

## Frontend Key Files

```
apps/frontend/src/
├── index.css                 Progue design tokens + Geist font imports
├── main.tsx                  ClerkProvider + QueryClientProvider + App
├── App.tsx                   Clerk-protected routes: /dashboard, /dashboard/keys, /dashboard/logs, /dashboard/billing
├── components/
│   └── DashboardLayout.tsx   Topbar (progue. wordmark) + 220px sidebar (3px brand-purple left bar on active)
├── pages/
│   ├── Overview.tsx          Stat cards + usage-by-server table
│   ├── ApiKeys.tsx           Create/revoke API keys, one-time raw key banner
│   ├── CallLogs.tsx          Paginated logs, expandable row drawer, latency heat color, 6px status dot
│   └── Billing.tsx           Placeholder (PR 5.2)
├── lib/
│   └── api.ts                apiFetch<T>(path, token, options) — Vite proxy /api → localhost:3000
└── types/
    └── dashboard.ts           ApiKey, ToolCallLog, UsageByServer, UsageResponse, LogsResponse
```

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Health check |
| GET | `/api/docs` | None | OpenAPI 3.1 spec |
| GET | `/api/keys` | Clerk JWT | List active API keys |
| POST | `/api/keys` | Clerk JWT | Create key (raw returned once) |
| DELETE | `/api/keys/:id` | Clerk JWT | Soft-revoke key |
| GET | `/api/logs` | Clerk JWT | Paginated tool call logs |
| GET | `/api/usage` | Clerk JWT | Usage aggregated by MCP server |

---

## PR History — Completed

| PR | Branch | Description | SHA |
|---|---|---|---|
| 4.1a | `feat/hts-data-load` | HTS code ingest into pgvector (OpenAI embeddings) | `319448a` |
| 4.1b | `feat/mcp-hts-classifier` | HTS Classifier MCP (classify, validate, duty lookup) | `3fd30b5` |
| 4.2 | `feat/approval-workflow` | Approval Workflow Engine (3 triggers, atomic decisions) | `d92ab7c` |
| 4.3 | `feat/phase2-stubs` | Phase 2 stubs (CarbonTracking, SupplierRisk — NotImplementedError) | `f1a52e3` |
| 4.4 | `feat/presell-docs` | Pre-sell docs + GET /api/docs OpenAPI route | `4d85d39` |
| 5.1 | `feat/developer-dashboard` | Developer dashboard (Progue design, API keys, call logs, usage) | `1da6fa3` |

---

## Pending PRs (not yet implemented)

### PR 5.2 — Stripe Billing (feat/stripe-billing)
Depends on: PR 5.1
- Stripe package install, `lib/stripe.ts` singleton
- Billing routes: `GET /api/billing/status`, `POST /api/billing/create-checkout`
- Tenant schema: `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `subscription_status`
- Frontend: Billing page real content (current plan, upgrade CTAs)

### PR 5.3 — Stripe Webhooks (feat/stripe-webhooks)
Depends on: PR 5.2
- `ProcessedWebhook` model (idempotency guard — `stripe_event_id` unique)
- `express.raw({ type: 'application/json' })` BEFORE `express.json()` on `/api/webhooks/stripe`
- Webhook handler: signature verify → idempotency guard → dispatch
- Events handled: `checkout.session.completed`, `customer.subscription.created/updated/deleted`
- Missing tenantId in metadata → log warn, return 200, no update
- Insert-after-handle pattern: `processedWebhook.create` only on success (allows Stripe retry on failure)
- `docs/runbooks/stripe-webhook-rollback.md`
- 8 tests via supertest

### Key adaptations needed for PR 5.3 (vs. spec):
- Spec uses `import { logger } from '../lib/logger.js'` → must be `import logger from '../lib/logger.js'` (default export)
- Spec uses `import { prisma } from '../lib/prisma.js'` → must be `import { prisma } from '../lib/db.js'`
- Spec uses `import { stripe } from '../lib/stripe.js'` → check if `lib/stripe.ts` exists from PR 5.2
- Test mocks: `vi.mock('../../lib/db.js', ...)` and `vi.mock('../../lib/stripe.js', ...)`
- `STRIPE_WEBHOOK_SECRET` env var should be in `.env` (added in PR 5.2)

---

## Test Suite Status

- **Backend:** 239 passing, 2 skipped (DB connection skips in `db.rls.test.ts`)
- **Frontend:** `tsc --noEmit` clean (0 errors)
- **Test runner:** `npx vitest run` from `apps/backend/`
- **Integration tests:** supertest + full app mock (Clerk, Prisma, Anthropic all mocked)

### Mock patterns (CRITICAL — follow exactly):
```typescript
// Logger mock — must use default export shape:
vi.mock('../../lib/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })) },
}));

// Clerk mock for integration tests:
vi.mock('@clerk/clerk-sdk-node', () => ({
  createClerkClient: vi.fn(() => ({
    verifyToken: vi.fn().mockImplementation((token: string) => {
      if (token === 'test-token-starter') {
        return Promise.resolve({ sub: 'user-test', org_id: 'tenant-test' });
      }
      return Promise.reject(new Error('Invalid token'));
    }),
  })),
}));

// DB mock — use res.locals.tenantId (not req.tenant.id):
// Routes read: const tenantId = res.locals.tenantId as string;
```

---

## Checkpoint Log

```
2026-05-18-00:38 | hts-data-load-complete   | 319448a
2026-05-18-02:57 | pr-4.1a-complete         | 319448a
2026-05-18-03:06 | pr-4.1b-complete         | 3fd30b5
2026-05-18-23:19 | pr-4.2-approval-workflow | d92ab7c
2026-05-18-23:26 | pr-4.3-phase2-stubs      | f1a52e3
2026-05-19-22:21 | pr-4.4-presell-docs      | 4d85d39
2026-05-19-22:25 | pr-5.1-developer-dashboard | 1da6fa3
2026-06-04-19:40 | prod-launch-clerk-v2-fix     | b083d19  ← last checkpoint
```

---

## Common Pitfalls

1. **Logger is a default export** — `import logger from './logger.js'`, NOT `{ logger }`
2. **Prisma DB client** — use `import { prisma } from './db.js'` (not `./prisma.js`)
3. **ToolCall field names are snake_case in DB** — `mcp_server`, `tool_name`, `model_used`, `latency_ms`, `input_tokens`, `output_tokens`, `cost_usd`, `success` (boolean, not status string)
4. **ApiKey fields** — `key_hash` (not `hash`), `revoked_at` (not `revokedAt`/`is_active`)
5. **Tenant tenantId from middleware** — `res.locals.tenantId as string`, NOT `req.tenant.id`
6. **Anthropic SDK stream flag** — always pass `stream: false` to get `Message` return type
7. **MOCK_CREATE capture in tests** — must capture `Anthropic.mock.results[0]?.value` at module scope BEFORE `beforeEach` runs (vi.clearAllMocks() wipes mock.results)
8. **Supabase MCP** — native PG connection broken on this machine; use `mcp__supabase__apply_migration` for all DDL
9. **Clerk v2 session tokens (CRITICAL)** — production Clerk issues `v: 2` JWTs that nest the org under an `o` claim (`{ id, rol, slg }`), NOT a flat `org_id`. `auth.ts` reads both: `payload.org_id ?? payload.o?.id`. If `tenantId` is null despite an active org, decode the JWT (`JSON.parse(atob(token.split('.')[1]))`) and check for the `o` claim. Do NOT assume `org_id` is flat.
10. **Self-healing tenants** — `ensureTenant` middleware (on `protectedRouter`, after `requireTenant`) upserts a Tenant row for the active org using **raw `prisma`** (the RLS `db` client rejects non-UUID ids). In-memory `knownTenants` cache → one write per tenant per process. New route tests must mock `prisma.tenant.upsert`.
11. **tenants.id is TEXT, not UUID** — migrated from `@db.Uuid` to `String` to store Clerk org ids (`org_...`). The RLS `db` extension in `db.ts` still has a `UUID_RE` guard, so tenant-scoped queries with org ids MUST use raw `prisma`, not `db`.

---

## Session Resume Checklist

When starting a new session:
1. `cd ~/Projects/prompturtle`
2. `git branch` — confirm which branch you're on
3. `npx vitest run` from `apps/backend/` — confirm 196 pass / 2 skip
4. `npx tsc --noEmit` from `apps/frontend/` — confirm clean
5. Check `git log --oneline -5` for latest context
6. Next up: **PR 5.2** (Stripe billing) → then **PR 5.3** (Stripe webhooks)
