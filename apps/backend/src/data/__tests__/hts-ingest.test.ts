import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks (before imports that use them) ----

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: Array.from({ length: 20 }, (_, i) => ({
          embedding: Array.from({ length: 1536 }, () => Math.random()),
          index:     i,
        })),
      }),
    },
  })),
}));

vi.mock('../../lib/db.js', () => ({
  prisma: {
    htsCode: {
      upsert: vi.fn().mockResolvedValue({ id: 'hts-id-001', code: '8471.30.01' }),
    },
    embeddingStore: {
      findFirst: vi.fn().mockResolvedValue(null), // not found → will insert
    },
    $executeRaw:  vi.fn().mockResolvedValue(1),
    $queryRaw:    vi.fn().mockResolvedValue([
      {
        code:        '8471.30.01',
        description: 'Portable automatic data processing machines',
        chapter:     '84',
        duty_rate:   'Free',
        similarity:  0.94,
      },
      {
        code:        '8471.41.01',
        description: 'Other automatic data processing machines',
        chapter:     '84',
        duty_rate:   'Free',
        similarity:  0.88,
      },
    ]),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { prisma } from '../../lib/db.js';
import { ingestHtsCodes, searchHtsCodes, validateEmbeddingDimensions } from '../hts-ingest.js';
import type { HtsSeedRecord } from '../hts-seed-data.js';

// Typed mock handles
const mockPrisma = prisma as unknown as {
  htsCode:        { upsert: ReturnType<typeof vi.fn> };
  embeddingStore: { findFirst: ReturnType<typeof vi.fn> };
  $executeRaw:    ReturnType<typeof vi.fn>;
  $queryRaw:      ReturnType<typeof vi.fn>;
};

const SAMPLE_RECORDS: HtsSeedRecord[] = [
  {
    code:        '8471.30.01',
    description: 'Portable automatic data processing machines',
    chapter:     '84',
    section:     'XVI',
    dutyRate:    'Free',
    unit:        'No.',
  },
  {
    code:        '8517.12.00',
    description: 'Telephones for cellular networks',
    chapter:     '85',
    section:     'XVI',
    dutyRate:    'Free',
    unit:        'No.',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default mocks after clearAllMocks
  mockPrisma.htsCode.upsert.mockResolvedValue({ id: 'hts-id-001', code: '8471.30.01' });
  mockPrisma.embeddingStore.findFirst.mockResolvedValue(null);
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$queryRaw.mockResolvedValue([
    {
      code:       '8471.30.01',
      description: 'Portable automatic data processing machines',
      chapter:    '84',
      duty_rate:  'Free',
      similarity: 0.94,
    },
    {
      code:        '8471.41.01',
      description: 'Other automatic data processing machines',
      chapter:     '84',
      duty_rate:   'Free',
      similarity:  0.88,
    },
  ]);
});

// ---- ingestHtsCodes ----

describe('ingestHtsCodes', () => {
  it('upserts one HtsCode record per seed entry', async () => {
    await ingestHtsCodes(SAMPLE_RECORDS);
    expect(mockPrisma.htsCode.upsert).toHaveBeenCalledTimes(2);
  });

  it('inserts embedding via $executeRaw for new records', async () => {
    mockPrisma.embeddingStore.findFirst.mockResolvedValue(null);
    await ingestHtsCodes(SAMPLE_RECORDS);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('skips embedding insert when embedding already exists', async () => {
    mockPrisma.embeddingStore.findFirst.mockResolvedValue({ id: 'existing-embed' });
    const result = await ingestHtsCodes(SAMPLE_RECORDS);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(result.skipped).toBe(2);
    expect(result.inserted).toBe(0);
  });

  it('returns correct inserted/skipped counts for mixed state', async () => {
    // First record new, second already embedded
    mockPrisma.embeddingStore.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-embed' });

    const result = await ingestHtsCodes(SAMPLE_RECORDS);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('is idempotent — two runs do not throw', async () => {
    await expect(ingestHtsCodes(SAMPLE_RECORDS)).resolves.toBeDefined();
    await expect(ingestHtsCodes(SAMPLE_RECORDS)).resolves.toBeDefined();
  });

  it('processes all records even across multiple batches', async () => {
    // 25 records → 2 batches (20 + 5) with BATCH_SIZE = 20
    const large = Array.from({ length: 25 }, (_, i) => ({
      code:        `8471.${String(i).padStart(2, '0')}.00`,
      description: `Test item ${i}`,
      chapter:     '84',
      section:     'XVI',
      dutyRate:    'Free',
      unit:        'No.',
    }));
    const result = await ingestHtsCodes(large);
    expect(result.inserted + result.skipped).toBe(25);
  });

  it('passes correct fields to htsCode.upsert', async () => {
    await ingestHtsCodes([SAMPLE_RECORDS[0]!]);
    expect(mockPrisma.htsCode.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where:  { code: '8471.30.01' },
        create: expect.objectContaining({ code: '8471.30.01', chapter: '84' }),
      }),
    );
  });
});

// ---- searchHtsCodes ----

describe('searchHtsCodes', () => {
  it('returns top-k results with similarity scores', async () => {
    const results = await searchHtsCodes('laptop computer', 2);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('code');
    expect(results[0]).toHaveProperty('similarity');
    expect(results[0]!.similarity).toBeGreaterThan(0);
  });

  it('maps duty_rate (snake_case) to dutyRate (camelCase)', async () => {
    const results = await searchHtsCodes('laptop', 1);
    expect(results[0]).toHaveProperty('dutyRate');
    expect(results[0]).not.toHaveProperty('duty_rate');
  });

  it('calls $queryRaw once per search', async () => {
    await searchHtsCodes('phone', 3);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('returns results with all required fields', async () => {
    const results = await searchHtsCodes('shirt', 1);
    expect(results[0]).toMatchObject({
      code:        expect.any(String),
      description: expect.any(String),
      chapter:     expect.any(String),
      dutyRate:    expect.any(String),
      similarity:  expect.any(Number),
    });
  });
});

// ---- validateEmbeddingDimensions ----

describe('validateEmbeddingDimensions', () => {
  it('resolves when model returns 1536 dimensions', async () => {
    // Default mock returns 1536-dim vectors — should pass
    await expect(validateEmbeddingDimensions()).resolves.toBeUndefined();
  });
});

// ---- HTS_SEED_DATA integrity checks ----

describe('HTS_SEED_DATA', async () => {
  const { HTS_SEED_DATA } = await import('../hts-seed-data.js');

  it('has at least 20 records', () => {
    expect(HTS_SEED_DATA.length).toBeGreaterThanOrEqual(20);
  });

  it('all records have required fields', () => {
    for (const record of HTS_SEED_DATA) {
      expect(record.code).toBeTruthy();
      expect(record.description).toBeTruthy();
      expect(record.chapter).toBeTruthy();
    }
  });

  it('no duplicate codes', () => {
    const codes  = HTS_SEED_DATA.map((r) => r.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('chapter field matches first 2 digits of code', () => {
    for (const record of HTS_SEED_DATA) {
      const chapterFromCode = record.code.substring(0, 2);
      expect(record.chapter).toBe(chapterFromCode);
    }
  });
});
