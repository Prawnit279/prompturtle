// dotenv is pre-loaded via `tsx -r dotenv/config` in the seed:hts npm script,
// so DATABASE_URL is already in process.env before PrismaClient initialises.
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
