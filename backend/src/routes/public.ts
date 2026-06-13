import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { generateBookingNumber } from '../utils/codes.js';
import { sendBookingConfirmation } from '../services/email/index.js';

const router = Router();

router.get('/:slug/ticket-types', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: req.params.slug, isActive: true },
    });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const types = await prisma.ticketType.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(types.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      price: t.price,
      category: t.category,
      color: t.color,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/:slug/bookings', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: req.params.slug, isActive: true },
    });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const data = z.object({
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().optional(),
      visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ticketTypeId: z.string(),
      quantity: z.number().int().positive().max(20),
    }).parse(req.body);

    const type = await prisma.ticketType.findFirst({
      where: { id: data.ticketTypeId, tenantId: tenant.id, isActive: true },
    });
    if (!type) return res.status(400).json({ error: 'Invalid ticket type' });

    const booking = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
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

    const emailResult = await sendBookingConfirmation({
      tenantId: tenant.id,
      to: data.customerEmail,
      parkName: tenant.name,
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
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
