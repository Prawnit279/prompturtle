import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { TierLimitExceededError } from './lib/cost-tracker.js';
import logger from './lib/logger.js';
import { auth } from './middleware/auth.js';
import { requireTenant } from './middleware/requireTenant.js';
import { withTenantContext } from './middleware/withTenantContext.js';
import { BolProcessorMCP } from './mcp/servers/BolProcessorMCP.js';
import { CarrierRatesMCP } from './mcp/servers/CarrierRatesMCP.js';
import { HtsClassifierMCP } from './mcp/servers/HtsClassifierMCP.js';
import { GuardrailViolationError } from './mcp/types.js';
import { registerServer } from './mcp/registry.js';

dotenv.config();

// ---- Startup env validation (M-5) ----
// In production, inject these via your hosting platform (Vercel/Railway).
// NOTE: CLERK_SECRET_KEY must be in the process env *before* Node starts — dotenv
// cannot back-fill modules (like auth.ts) that read env vars at import/module-load time.
const REQUIRED_ENV = ['CLERK_SECRET_KEY', 'DATABASE_URL', 'FRONTEND_URL'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error({ key }, 'startup.missing_env_var');
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT ?? 3000;

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

// ---- Protected router ----
// All feature routes must mount onto this router — enforces auth + tenant context.
// Usage: app.use('/api/v1', protectedRouter);
export const protectedRouter = express.Router();
protectedRouter.use(requireTenant);
protectedRouter.use(withTenantContext);

// ---- Global error handler (H-5) ----
// MUST be last app.use() — 4-argument signature tells Express it's an error handler.
// Sanitizes error details to prevent information leakage to callers.
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

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'server.started'); // L-1: structured log instead of console.log
});

export default app;
