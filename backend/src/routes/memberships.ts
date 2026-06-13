import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { generateMemberCode } from '../utils/codes.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

router.get('/plans', requirePermission('memberships.view'), async (req, res, next) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: { tenantId: req.tenant!.id, isActive: true },
      orderBy: { price: 'asc' },
    });
    res.json(plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      durationDays: p.durationDays,
      benefits: p.benefits,
      isActive: p.isActive,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/plans', requirePermission('memberships.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().positive(),
      durationDays: z.number().int().positive().default(365),
      benefits: z.array(z.string()).default([]),
    }).parse(req.body);

    const plan = await prisma.membershipPlan.create({
      data: { ...data, tenantId: req.tenant!.id },
    });
    res.status(201).json({ id: plan.id, ...data });
  } catch (err) {
    next(err);
  }
});

router.get('/', requirePermission('memberships.view'), async (req, res, next) => {
  try {
    const members = await prisma.membership.findMany({
      where: { tenantId: req.tenant!.id },
      include: { plan: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(members.map((m) => ({
      id: m.id,
      memberName: m.memberName,
      memberEmail: m.memberEmail,
      memberCode: m.memberCode,
      planName: m.plan?.name,
      startsAt: m.startsAt,
      expiresAt: m.expiresAt,
      isActive: m.isActive,
      createdAt: m.createdAt,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('memberships.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      planId: z.string(),
      memberName: z.string().min(1),
      memberEmail: z.string().email().optional(),
    }).parse(req.body);

    const plan = await prisma.membershipPlan.findFirst({
      where: { id: data.planId, tenantId: req.tenant!.id, isActive: true },
    });
    if (!plan) return res.status(400).json({ error: 'Invalid membership plan' });

    const memberCode = generateMemberCode();
    const qrData = JSON.stringify({ code: memberCode, tenantId: req.tenant!.id, type: 'membership' });
    const qrImage = await QRCode.toDataURL(qrData, { width: 256, margin: 1 });

    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    const member = await prisma.membership.create({
      data: {
        tenantId: req.tenant!.id,
        planId: plan.id,
        memberName: data.memberName,
        memberEmail: data.memberEmail,
        memberCode,
        qrData,
        startsAt,
        expiresAt,
      },
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'membership.create',
      entityType: 'membership',
      entityId: member.id,
    });

    res.status(201).json({
      id: member.id,
      memberName: member.memberName,
      memberCode: member.memberCode,
      planName: plan.name,
      qrImage,
      expiresAt: member.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
