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
import { withTenantContext } from './middleware/withTenantContext.js';
import docsRouter from './routes/docs.js';
import keysRouter from './routes/keys.js';
import logsRouter from './routes/logs.js';
import usageRouter from './routes/usage.js';
import { BolProcessorMCP } from './mcp/servers/BolProcessorMCP.js';
import { CarrierRatesMCP } from './mcp/servers/CarrierRatesMCP.js';
import { CarbonTrackingMCP } from './mcp/servers/CarbonTrackingMCP.js';
import { HtsClassifierMCP } from './mcp/servers/HtsClassifierMCP.js';
import { SupplierRiskMCP } from './mcp/servers/SupplierRiskMCP.js';
import { GuardrailViolationError } from './mcp/types.js';
import { registerServer } from './mcp/registry.js';

const app = express();

// ---- Global middleware ----
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

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

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'prompturtle-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ---- MCP server registration ----
registerServer(new BolProcessorMCP());
registerServer(new CarrierRatesMCP());
registerServer(new HtsClassifierMCP());
registerServer(new CarbonTrackingMCP());
registerServer(new SupplierRiskMCP());

// ---- Protected router ----
// All feature routes must mount onto this router — enforces auth + tenant context.
export const protectedRouter = express.Router();
protectedRouter.use(requireTenant);
protectedRouter.use(withTenantContext);

// Dashboard API routes (all require auth via protectedRouter middleware)
protectedRouter.use('/keys',  keysRouter);
protectedRouter.use('/logs',  logsRouter);
protectedRouter.use('/usage', usageRouter);

app.use('/api', protectedRouter);

// ---- Global error handler (H-5) ----
// MUST be last app.use() — 4-argument signature tells Express it's an error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof GuardrailViolationError) {
    res.status(429).json({ error: 'guardrail_violation', rule: err.rule });
    return;
  }
  if (err instanceof TierLimitExceededError) {
    res.status(429).json({ error: 'rate_limit_exceeded' });
    return;
  }
  logger.error({ err }, 'unhandled_error');
  res.status(500).json({ error: 'internal_error' });
});

export default app;
