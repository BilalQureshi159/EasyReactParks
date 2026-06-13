import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { generateBookingNumber } from '../utils/codes.js';
import { logAudit } from '../services/audit.js';
import { sendBookingConfirmation } from '../services/email/index.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

router.get('/', requirePermission('bookings.view'), async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { tenantId: req.tenant!.id },
      include: { ticketType: { select: { name: true } } },
      orderBy: { visitDate: 'desc' },
      take: 100,
    });

    res.json(bookings.map((b) => ({
      id: b.id,
      bookingNumber: b.bookingNumber,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      visitDate: b.visitDate,
      ticketTypeId: b.ticketTypeId,
      ticketTypeName: b.ticketType?.name,
      quantity: b.quantity,
      total: b.total,
      status: b.status,
      createdAt: b.createdAt,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('bookings.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().optional(),
      visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ticketTypeId: z.string(),
      quantity: z.number().int().positive().max(20),
    }).parse(req.body);

    const type = await prisma.ticketType.findFirst({
      where: { id: data.ticketTypeId, tenantId: req.tenant!.id, isActive: true },
    });
    if (!type) return res.status(400).json({ error: 'Invalid ticket type' });

    const booking = await prisma.booking.create({
      data: {
        tenantId: req.tenant!.id,
        bookingNumber: generateBookingNumber(),
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        visitDate: new Date(data.visitDate),
        ticketTypeId: type.id,
        quantity: data.quantity,
        total: type.price * data.quantity,
        status: 'confirmed',
      },
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user?.id,
      action: 'booking.create',
      entityType: 'booking',
      entityId: booking.id,
    });

    const emailResult = await sendBookingConfirmation({
      tenantId: req.tenant!.id,
      to: data.customerEmail,
      parkName: req.tenant!.name,
      customerName: data.customerName,
      bookingNumber: booking.bookingNumber,
      visitDate: data.visitDate,
      ticketTypeName: type.name,
      quantity: data.quantity,
      total: booking.total,
    });

    res.status(201).json({
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      total: booking.total,
      status: booking.status,
      email: {
        sent: emailResult.sent,
        previewUrl: emailResult.previewUrl,
        error: emailResult.error,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requirePermission('bookings.manage'), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']) }).parse(req.body);

    const existing = await prisma.booking.findFirst({
      where: { id: String(req.params.id), tenantId: req.tenant!.id },
    });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const booking = await prisma.booking.update({
      where: { id: existing.id },
      data: { status },
    });

    res.json({ id: booking.id, status: booking.status });
  } catch (err) {
    next(err);
  }
});

export default router;
