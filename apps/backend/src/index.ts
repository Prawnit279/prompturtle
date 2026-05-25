import dotenv from 'dotenv';

dotenv.config();

// Fail fast on missing env vars — must run before any module that reads process.env.
// NOTE: CLERK_SECRET_KEY must be in the process env *before* Node starts; dotenv
// cannot back-fill modules that read env vars at import/module-load time.
import { validateEnv } from './lib/env-validate.js';
validateEnv();

import logger from './lib/logger.js';
import app from './app.js';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'server.started'); // L-1: structured log instead of console.log
});

export default app;
