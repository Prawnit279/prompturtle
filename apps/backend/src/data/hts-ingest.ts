import OpenAI from 'openai';

import { prisma } from '../lib/db.js';
import logger from '../lib/logger.js';
import { HTS_SEED_DATA, type HtsSeedRecord } from './hts-seed-data.js';

// Lazy singleton — defer construction until first call so dotenv.config() has
// already run in the entry point (seed-hts.ts or index.ts) before OPENAI_API_KEY is read.
let _openai: OpenAI | undefined;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS  = 1536;
const BATCH_SIZE      = 20; // OpenAI supports up to 2048 inputs per call; keep batches small

// ---- Public API ----

/**
 * Ingest all HTS seed records into the DB and generate pgvector embeddings.
 *
 * Idempotent — skips records that already have an embedding (upsert by code).
 * Safe to run multiple times.
 *
 * Uses `prisma` (raw base client, no RLS) because HTS data is global
 * and not scoped to any tenant.
 */
export async function ingestHtsCodes(
  records: HtsSeedRecord[] = HTS_SEED_DATA,
): Promise<{ inserted: number; skipped: number }> {
  logger.info({ total: records.length }, 'hts-ingest.start');

  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch  = records.slice(i, i + BATCH_SIZE);
    const result = await processBatch(batch);
    inserted += result.inserted;
    skipped  += result.skipped;
    logger.info(
      { batch: Math.floor(i / BATCH_SIZE) + 1, inserted, skipped },
      'hts-ingest.batch.done',
    );
  }

  logger.info({ inserted, skipped }, 'hts-ingest.complete');
  return { inserted, skipped };
}

/**
 * Search HTS codes by semantic similarity to a product description.
 * Returns top-k results ordered by cosine similarity (highest first).
 *
 * Uses `prisma.$queryRaw` to bypass RLS — HTS data is global.
 */
export async function searchHtsCodes(
  query: string,
  topK = 5,
): Promise<
  Array<{
    code:        string;
    description: string;
    chapter:     string;
    dutyRate:    string;
    similarity:  number;
  }>
> {
  const embedding     = await generateEmbedding(query);
  const vectorLiteral = `[${embedding.join(',')}]`;

  // pgvector cosine distance operator <=> (lower = more similar)
  // Cast to ::vector so pgvector can parse the literal
  const results = await prisma.$queryRaw<
    Array<{
      code:        string;
      description: string;
      chapter:     string;
      duty_rate:   string;
      similarity:  number;
    }>
  >`
    SELECT
      h.code,
      h.description,
      h.chapter,
      h.duty_rate,
      1 - (e.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM embedding_store e
    JOIN hts_codes h ON h.id = e.entity_id
    WHERE e.namespace = 'hts-codes'
    ORDER BY e.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `;

  return results.map((r) => ({
    code:        r.code,
    description: r.description,
    chapter:     r.chapter,
    dutyRate:    r.duty_rate,
    similarity:  r.similarity,
  }));
}

/**
 * Confirm that the embedding model returns the expected dimension count.
 * Run once at startup before any ingest or search.
 */
export async function validateEmbeddingDimensions(): Promise<void> {
  const test = await generateEmbedding('test');
  if (test.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMS}, got ${test.length}. ` +
        `Check EMBEDDING_MODEL and pgvector schema.`,
    );
  }
  logger.info({ dims: test.length }, 'hts-ingest.dimensions.ok');
}

// ---- Private helpers ----

async function processBatch(
  records: HtsSeedRecord[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped  = 0;

  // Concatenate code + description for richer semantic signal
  const inputs     = records.map((r) => `HTS ${r.code}: ${r.description}`);
  const embeddings = await generateEmbeddings(inputs);

  for (let j = 0; j < records.length; j++) {
    const record    = records[j];
    const embedding = embeddings[j];
    if (!record || !embedding) continue;

    // Upsert the HtsCode row (update description/metadata if code already exists)
    const htsCode = await prisma.htsCode.upsert({
      where:  { code: record.code },
      update: {
        description: record.description,
        chapter:     record.chapter,
        section:     record.section,
        duty_rate:   record.dutyRate,
        unit:        record.unit,
      },
      create: {
        code:        record.code,
        description: record.description,
        chapter:     record.chapter,
        section:     record.section,
        duty_rate:   record.dutyRate,
        unit:        record.unit,
      },
    });

    // Skip if an embedding already exists for this entity
    const existing = await prisma.embeddingStore.findFirst({
      where: { namespace: 'hts-codes', entity_id: htsCode.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Insert embedding via raw SQL — Prisma cannot write the vector type natively
    const vectorLiteral = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`
      INSERT INTO embedding_store (id, namespace, entity_id, embedding, created_at)
      VALUES (
        gen_random_uuid(),
        'hts-codes',
        ${htsCode.id},
        ${vectorLiteral}::vector,
        NOW()
      )
    `;

    inserted++;
  }

  return { inserted, skipped };
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model:      EMBEDDING_MODEL,
    input:      text,
    dimensions: EMBEDDING_DIMS,
  });
  const data = response.data[0];
  if (!data) throw new Error('OpenAI embeddings.create returned empty response');
  return data.embedding;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await getOpenAI().embeddings.create({
    model:      EMBEDDING_MODEL,
    input:      texts,
    dimensions: EMBEDDING_DIMS,
  });
  return response.data.map((d) => d.embedding);
}
