import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit } from '../services/audit.js';
import { slugifyTicketType, uniqueTicketTypeSlug } from '../utils/codes.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

router.get('/types', requirePermission('tickets.view'), async (req, res, next) => {
  try {
    const types = await prisma.ticketType.findMany({
      where: { tenantId: req.tenant!.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(types.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      price: t.price,
      category: t.category,
      color: t.color,
      isActive: t.isActive,
      maxPerOrder: t.maxPerOrder,
      validDays: t.validDays,
      sortOrder: t.sortOrder,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/types', requirePermission('tickets.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens').optional(),
      description: z.string().optional(),
      price: z.number().positive(),
      category: z.string().default('general'),
      color: z.string().default('#3B82F6'),
      maxPerOrder: z.number().int().positive().default(10),
      validDays: z.number().int().positive().default(1),
      isActive: z.boolean().default(true),
    }).parse(req.body);

    const baseSlug = data.slug ?? slugifyTicketType(data.name);
    const slug = await uniqueTicketTypeSlug(req.tenant!.id, baseSlug);

    const type = await prisma.ticketType.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        price: data.price,
        category: data.category,
        color: data.color,
        maxPerOrder: data.maxPerOrder,
        validDays: data.validDays,
        isActive: data.isActive,
        tenantId: req.tenant!.id,
      },
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'ticket_type.create',
      entityType: 'ticket_type',
      entityId: type.id,
    });

    res.status(201).json({
      id: type.id,
      name: type.name,
      slug: type.slug,
      description: type.description,
      price: type.price,
      category: type.category,
      color: type.color,
      isActive: type.isActive,
      maxPerOrder: type.maxPerOrder,
      validDays: type.validDays,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/types/:id', requirePermission('tickets.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
      description: z.string().optional(),
      price: z.number().positive().optional(),
      category: z.string().optional(),
      color: z.string().optional(),
      maxPerOrder: z.number().int().positive().optional(),
      validDays: z.number().int().positive().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const existing = await prisma.ticketType.findFirst({
      where: { id: String(req.params.id), tenantId: req.tenant!.id },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket type not found' });

    let slug = data.slug;
    if (slug && slug !== existing.slug) {
      const taken = await prisma.ticketType.findFirst({
        where: { tenantId: req.tenant!.id, slug, id: { not: existing.id } },
      });
      if (taken) return res.status(409).json({ error: 'Slug already in use' });
    }

    const type = await prisma.ticketType.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        slug,
        description: data.description,
        price: data.price,
        category: data.category,
        color: data.color,
        maxPerOrder: data.maxPerOrder,
        validDays: data.validDays,
        isActive: data.isActive,
      },
    });

    res.json({
      id: type.id,
      name: type.name,
      slug: type.slug,
      price: type.price,
      isActive: type.isActive,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const where: { tenantId: string; status?: string } = { tenantId: req.tenant!.id };
    if (req.query.status) where.status = req.query.status as string;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        ticketType: { select: { name: true, slug: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(tickets.map((t) => ({
      id: t.id,
      tenantId: t.tenantId,
      orderId: t.order ? { orderNumber: t.order.orderNumber } : t.orderId,
      ticketTypeId: t.ticketType ? { name: t.ticketType.name, slug: t.ticketType.slug } : t.ticketTypeId,
      ticketCode: t.ticketCode,
      qrData: t.qrData,
      status: t.status,
      validFrom: t.validFrom,
      validUntil: t.validUntil,
      scannedAt: t.scannedAt,
      scannedById: t.scannedById,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
