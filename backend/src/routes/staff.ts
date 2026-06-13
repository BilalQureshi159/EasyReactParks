import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  createParkStaff,
  listParkStaff,
  updateParkStaff,
  PARK_STAFF_ROLES,
} from '../services/staff.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string().min(1),
  password: z.string().min(6).optional(),
});

const updateSchema = z.object({
  role: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
});

router.get('/', requirePermission('staff.view'), async (req, res, next) => {
  try {
    const staff = await listParkStaff(req.tenant!.id);
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('staff.manage'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const staff = await createParkStaff({
      tenantId: req.tenant!.id,
      ...data,
      allowedRoles: PARK_STAFF_ROLES,
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'staff.create',
      entityType: 'user',
      entityId: staff.id,
      details: { email: staff.email, role: staff.role },
    });

    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requirePermission('staff.manage'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const staff = await updateParkStaff({
      tenantId: req.tenant!.id,
      userId: String(req.params.id),
      ...data,
      allowedRoles: PARK_STAFF_ROLES,
      actorId: req.user!.id,
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'staff.update',
      entityType: 'user',
      entityId: staff.id,
      details: data,
    });

    res.json(staff);
  } catch (err) {
    next(err);
  }
});

export default router;
