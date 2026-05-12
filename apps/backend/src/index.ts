import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

import logger from './lib/logger';
import { auth } from './middleware/auth';
import { requireTenant } from './middleware/requireTenant';
import { withTenantContext } from './middleware/withTenantContext';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

// Auth runs globally — extracts JWT claims but does not block unauthenticated requests.
// Use requireTenant + withTenantContext on routes that need DB access.
app.use((req, res, next) => {
  auth(req, res, next).catch(next);
});

// Public routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'prompturtle-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Protected route stack placeholder — real routers added in later PRs.
// Pattern: app.use('/api/v1', requireTenant, withTenantContext, v1Router)
app.get('/api/v1/ping', requireTenant, withTenantContext, (_req, res) => {
  res.json({ pong: true });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, '🐢 Prompturtle API running');
});

export default app;
