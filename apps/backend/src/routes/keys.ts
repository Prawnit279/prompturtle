import { createHash, randomBytes } from 'crypto';

import { Router, type Request, type Response } from 'express';

import { prisma } from '../lib/db.js';
import logger from '../lib/logger.js';

const router = Router();

/** GET /api/keys — list active keys for the authenticated tenant */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const keys = await prisma.apiKey.findMany({
    where:   { tenant_id: tenantId, revoked_at: null },
    select:  { id: true, name: true, prefix: true, created_at: true, last_used_at: true },
    orderBy: { created_at: 'desc' },
  });
  res.json({
    keys: keys.map((k) => ({
      id:         k.id,
      name:       k.name,
      prefix:     k.prefix,
      createdAt:  k.created_at,
      lastUsedAt: k.last_used_at,
    })),
  });
});

/** POST /api/keys — create a new key; raw key returned once only */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const { name } = req.body as { name?: string };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const raw    = `ptk_${randomBytes(32).toString('hex')}`;
  const prefix = raw.slice(0, 12);
  const hash   = createHash('sha256').update(raw).digest('hex');

  const key = await prisma.apiKey.create({
    data:   { tenant_id: tenantId, name: name.trim(), prefix, key_hash: hash },
    select: { id: true, name: true, prefix: true, created_at: true },
  });

  logger.info({ tenantId, keyId: key.id }, 'api_key.created');

  res.status(201).json({
    key: {
      id:        key.id,
      name:      key.name,
      prefix:    key.prefix,
      createdAt: key.created_at,
      raw,                         // shown once — never stored in plain text
    },
  });
});

/** DELETE /api/keys/:id — soft-revoke a key */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const keyId    = req.params['id'] as string;

  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, tenant_id: tenantId, revoked_at: null },
  });

  if (!existing) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }

  // Use the confirmed id from the DB record to satisfy exactOptionalPropertyTypes
  await prisma.apiKey.update({
    where: { id: existing.id, key_hash: existing.key_hash },
    data:  { revoked_at: new Date() },
  });

  logger.info({ tenantId, keyId }, 'api_key.revoked');
  res.status(204).send();
});

export default router;
