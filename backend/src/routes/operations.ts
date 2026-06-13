import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { getParkDayStatus } from '../services/parkDay.js';
import { toDateString } from '../utils/date.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

router.get('/day', requirePermission('operations.manage', 'pos.use'), async (req, res, next) => {
  try {
    const date = (req.query.date as string) || toDateString();
    const status = await getParkDayStatus(req.tenant!.id, date);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.put('/day', requirePermission('operations.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isOpen: z.boolean(),
      note: z.string().optional(),
    }).parse(req.body);

    const record = await prisma.parkDay.upsert({
      where: {
        tenantId_date: { tenantId: req.tenant!.id, date: data.date },
      },
      create: {
        tenantId: req.tenant!.id,
        date: data.date,
        isOpen: data.isOpen,
        note: data.note,
        updatedById: req.user!.id,
      },
      update: {
        isOpen: data.isOpen,
        note: data.note,
        updatedById: req.user!.id,
      },
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: data.isOpen ? 'park.open' : 'park.close',
      entityType: 'park_day',
      entityId: data.date,
      details: { note: data.note },
    });

    res.json({
      date: record.date,
      isOpen: record.isOpen,
      note: record.note,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
