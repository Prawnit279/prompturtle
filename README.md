# Progue.ai

> Pre-built AI context for supply chain software vendors — from 6 weeks to 1 week.

## What it is

Progue.ai sells API-delivered context infrastructure to SC software vendors (TMS, freight visibility, 3PL, carrier management). Instead of hand-crafting MCP servers and guardrail engines, vendors embed Progue's API and go live in under a week.

## API

Base URL: `https://api.progue.ai`

Docs: [API Reference](docs/api-reference.md) | [OpenAPI](docs/openapi.yaml)

Interactive: `GET /api/docs` returns the OpenAPI JSON spec.

## Developer Dashboard

[https://app.progue.ai](https://app.progue.ai) — API key management, call logs, usage metrics, billing.

## Modules (v1)

| Module | Tools | Status |
|--------|-------|--------|
| **BOL Processor** | parse, validate, flag discrepancies | ✅ MCP server live |
| **Carrier Rates** | get rates, compare options, recommend | ✅ MCP server live |
| **HTS Classifier** | classify, validate, duty lookup | ✅ MCP server live |
| **Approval Workflow** | guardrail-triggered approvals via email | ✅ Engine live |
| **Audit Trail** | full decision history | ✅ Library live |
| **Carbon Tracking** | emissions per shipment | 🔜 Phase 2 |
| **Supplier Risk** | risk scoring and alerts | 🔜 Phase 2 |

> **Note:** MCP HTTP route handlers (`/api/mcp/*`) are planned for the next sprint.
> The MCP servers and approval/audit libraries are fully implemented — only the REST adapters are pending.

## Pricing

| Tier | Price | Calls/month | Rate limit |
|------|-------|-------------|------------|
| Starter | $149/mo | 1,000 | 10/min |
| Growth | $599/mo | 10,000 | 60/min |
| Enterprise | $1,999/mo | 100,000 | 300/min |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express, TypeScript, Prisma 5 |
| Database | Supabase PostgreSQL + pgvector (cosine similarity) |
| Auth | Clerk (JWT + webhooks) |
| AI | Anthropic Claude (Opus, Sonnet, Haiku) |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Billing | Stripe (subscriptions + Customer Portal) |
| Email | Resend (transactional) |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Deploy | Vercel (frontend) + Railway (backend) |
| Tests | Vitest + supertest (unit/integration), Playwright (E2E) |
| CI/CD | GitHub Actions |

## Local Development

```bash
# Install dependencies
npm install

# Copy and fill env vars
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Start both servers
npm run dev
```

Backend: `http://localhost:3000`
Frontend: `http://localhost:5173`

## Running Tests

```bash
# Unit + integration tests
npm run test

# E2E tests (requires running app + Clerk test user)
npm run e2e

# Load test (production only)
LOAD_TEST_URL=https://api.progue.ai LOAD_TEST_API_KEY=ptk_xxx npm run load-test
```

## Deploy

See [docs/env-setup.md](docs/env-setup.md) for the full pre-deploy checklist and environment variable reference.

Deploy is triggered automatically on push to `main` via GitHub Actions:
- Backend → Railway
- Frontend → Vercel
