/**
 * Express application factory — no listen() call here.
 * Imported by index.ts (production) and tests.
 */
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { TierLimitExceededError } from './lib/cost-tracker.js';
import logger from './lib/logger.js';
import { auth } from './middleware/auth.js';
import { requireTenant } from './middleware/requireTenant.js';
import { ensureTenant } from './middleware/ensureTenant.js';
import { withTenantContext } from './middleware/withTenantContext.js';
import billingRouter from './routes/billing.js';
import docsRouter from './routes/docs.js';
import clerkWebhookRouter from './routes/clerk-webhooks.js';
import webhookRouter from './routes/webhooks.js';
import keysRouter from './routes/keys.js';
import logsRouter from './routes/logs.js';
import riskRouter from './routes/risk.js';
import usageRouter from './routes/usage.js';
import webhookEndpointsRouter from './routes/webhook-endpoints.js';
import { BolProcessorMCP } from './mcp/servers/BolProcessorMCP.js';
import { CarrierRatesMCP } from './mcp/servers/CarrierRatesMCP.js';
import { CarbonTrackingMCP } from './mcp/servers/CarbonTrackingMCP.js';
import { HtsClassifierMCP } from './mcp/servers/HtsClassifierMCP.js';
import { RiskScorerMCP } from './mcp/servers/RiskScorerMCP.js';
import { SupplierRiskMCP } from './mcp/servers/SupplierRiskMCP.js';
import { GuardrailViolationError } from './mcp/types.js';
import { registerServer } from './mcp/registry.js';

const app = express();

// ---- Security headers ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      mediaSrc:    ["'self'"],
      frameSrc:    ["'none'"],
    },
  },
  // Clerk dashboard embeds require this to be disabled
  crossOriginEmbedderPolicy: false,
}));

// ---- CORS — locked to FRONTEND_URL + APP_URL in production ----
// FRONTEND_URL = https://progue.ai (marketing site)
// APP_URL      = https://app.progue.ai (dashboard) — set in Railway env vars
const allowedOrigins: string[] =
  process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL ?? '', process.env.APP_URL ?? ''].filter(Boolean)
    : (
        ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL ?? '', process.env.APP_URL ?? '']
          .filter(Boolean)
      );

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (Stripe/Clerk webhooks have no Origin header)
    if (!origin) { callback(null, true); return; }
    if (allowedOrigins.includes(origin)) { callback(null, true); return; }
    // Reject with null/false — letting the error propagate causes a 500;
    // returning false tells the browser the origin is blocked (proper 403-ish behavior).
    callback(null, false);
  },
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:    true,
}));

// Webhook routes — raw body MUST be registered before express.json().
// Signature verification (Stripe + Clerk/svix) requires the unparsed Buffer.
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);
app.use('/api/webhooks/clerk',  express.raw({ type: 'application/json' }), clerkWebhookRouter);

app.use(express.json());

// ---- Health check ----
// Mounted BEFORE rate limiting and auth so it is fully public and unthrottled.
// Load balancers, uptime monitors, and load tests may send stale/foreign
// Authorization headers; the global auth parser would otherwise 401 a
// non-JWT Bearer token, and the rate limiter would 429 burst probes.
// A health check must never depend on auth or rate-limit state.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'progue-api',
    version: '0.1.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// HTTP-level rate limiting — fires before auth, protects unauthenticated floods (M-4)
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
  }),
);

// Auth — sets res.locals.tenantId / userId on valid JWTs, calls next() otherwise (C-2)
app.use((req: Request, res: Response, next: NextFunction) => {
  auth(req, res, next).catch(next);
});

// ---- Public routes ----
app.use('/api/docs', docsRouter);

// ---- MCP server registration ----
registerServer(new BolProcessorMCP());
registerServer(new CarrierRatesMCP());
registerServer(new HtsClassifierMCP());
registerServer(new CarbonTrackingMCP());
registerServer(new SupplierRiskMCP());
registerServer(new RiskScorerMCP());

// ---- Protected router ----
// All feature routes must mount onto this router — enforces auth + tenant context.
export const protectedRouter = express.Router();
protectedRouter.use(requireTenant);
// Self-heal: guarantee a Tenant row exists for the active org before any
// route runs, so writes never fail on a missing FK (cached after first hit).
protectedRouter.use((req: Request, res: Response, next: NextFunction) => {
  ensureTenant(req, res, next).catch(next);
});
protectedRouter.use(withTenantContext);

// Dashboard API routes (all require auth via protectedRouter middleware)
protectedRouter.use('/billing', billingRouter);
protectedRouter.use('/keys',    keysRouter);
protectedRouter.use('/logs',    logsRouter);
protectedRouter.use('/usage',   usageRouter);
protectedRouter.use('/risk',    riskRouter);
protectedRouter.use('/webhooks', webhookEndpointsRouter);

app.use('/api', protectedRouter);

// ---- Global error handler (H-5) ----
// MUST be last app.use() — 4-argument signature tells Express it's an error handler.
// Stack traces are never sent to clients; message is shown only in non-production.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof GuardrailViolationError) {
    res.status(429).json({ error: 'guardrail_violation', rule: err.rule });
    return;
  }
  if (err instanceof TierLimitExceededError) {
    res.status(429).json({ error: 'rate_limit_exceeded' });
    return;
  }

  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
  logger.error({ err, path: req.path, method: req.method }, 'unhandled_error');

  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err instanceof Error ? err.message : 'Internal server error'),
  });
});

export default app;
