import dotenv from 'dotenv';

dotenv.config();

import logger from '../lib/logger.js';
import { ingestHtsCodes, validateEmbeddingDimensions } from '../data/hts-ingest.js';

async function main(): Promise<void> {
  logger.info('seed-hts.start');

  // Fail fast if the embedding model dimension doesn't match the schema
  await validateEmbeddingDimensions();

  const result = await ingestHtsCodes();
  logger.info(result, 'seed-hts.done');

  process.exit(0);
}

main().catch((err: unknown) => {
  logger.error({ err }, 'seed-hts.fatal');
  process.exit(1);
});
