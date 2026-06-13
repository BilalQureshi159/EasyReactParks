import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

router.get('/', requirePermission('coupons.view'), async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: { tenantId: req.tenant!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(coupons.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minOrderAmount: c.minOrderAmount,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      isActive: c.isActive,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('coupons.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      code: z.string().min(2),
      description: z.string().optional(),
      discountType: z.enum(['percentage', 'fixed']),
      discountValue: z.number().positive(),
      minOrderAmount: z.number().min(0).default(0),
      maxUses: z.number().int().positive().optional(),
      validUntil: z.string().datetime().optional(),
      isActive: z.boolean().default(true),
    }).parse(req.body);

    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount,
        maxUses: data.maxUses,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        isActive: data.isActive,
        tenantId: req.tenant!.id,
      },
    });

    res.status(201).json({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/validate', requirePermission('coupons.view', 'pos.use'), async (req, res, next) => {
  try {
    const { code, orderAmount } = z.object({
      code: z.string(),
      orderAmount: z.number().positive(),
    }).parse(req.body);

    const now = new Date();
    const coupon = await prisma.coupon.findFirst({
      where: {
        tenantId: req.tenant!.id,
        code: code.toUpperCase(),
        isActive: true,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    });

    if (!coupon || (coupon.maxUses && coupon.usedCount >= coupon.maxUses)) {
      return res.json({ valid: false, message: 'Invalid coupon code' });
    }

    if (coupon.minOrderAmount > orderAmount) {
      return res.json({ valid: false, message: `Minimum order amount is $${coupon.minOrderAmount}` });
    }

    const discount = coupon.discountType === 'percentage'
      ? orderAmount * (coupon.discountValue / 100)
      : coupon.discountValue;

    res.json({
      valid: true,
      discount: Math.min(discount, orderAmount),
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
