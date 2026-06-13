import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant, requirePermission('audit.view'));

router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string || '50');
    const logs = await prisma.auditLog.findMany({
      where: { tenantId: req.tenant!.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const userIds = logs.map((l) => l.userId).filter((id): id is string => Boolean(id));
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } } })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    res.json(logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      userName: l.userId ? userMap[l.userId] : null,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
