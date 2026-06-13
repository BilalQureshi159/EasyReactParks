import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { generateOrderNumber, formatTicketCode } from '../utils/codes.js';
import { logAudit } from '../services/audit.js';
import { sendOrderConfirmation } from '../services/email/index.js';
import { assertParkIsOpen } from '../services/parkDay.js';
import { toDateString, dayBounds } from '../utils/date.js';
import { mapOrderListItem, mapOrderDetail } from '../utils/orders.js';
import { searchOrders } from '../utils/orderSearch.js';
import { aggregateOrderSummary } from '../utils/reportAggregates.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

router.post('/orders', requirePermission('pos.use'), async (req, res, next) => {
  try {
    const data = z.object({
      items: z.array(z.object({
        ticketTypeId: z.string(),
        quantity: z.number().int().positive().max(20),
      })).min(1),
      orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      customerName: z.string().optional(),
      customerEmail: z.union([z.string().email(), z.literal('')]).optional(),
      customerPhone: z.string().optional(),
      paymentMethod: z.enum(['cash', 'card', 'other']).default('cash'),
      couponCode: z.string().optional(),
    }).parse(req.body);

    const tenantId = req.tenant!.id;
    const orderDate = data.orderDate || toDateString();

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { parkCode: true, name: true },
    });
    if (!tenant?.parkCode) {
      return res.status(500).json({ error: 'Park order code is not configured' });
    }

    await assertParkIsOpen(tenantId, orderDate);

    const typeIds = data.items.map((i) => i.ticketTypeId);
    const types = await prisma.ticketType.findMany({
      where: { tenantId, id: { in: typeIds }, isActive: true },
    });

    const typeMap = new Map(types.map((t) => [t.id, t]));
    let subtotal = 0;

    for (const item of data.items) {
      const type = typeMap.get(item.ticketTypeId);
      if (!type) {
        return res.status(400).json({ error: `Invalid ticket type: ${item.ticketTypeId}` });
      }
      subtotal += type.price * item.quantity;
    }

    let discount = 0;
    let couponId: string | undefined;

    if (data.couponCode) {
      const now = new Date();
      const coupon = await prisma.coupon.findFirst({
        where: {
          tenantId,
          code: data.couponCode.toUpperCase(),
          isActive: true,
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
      });

      if (coupon && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
        couponId = coupon.id;
        discount = coupon.discountType === 'percentage'
          ? subtotal * (coupon.discountValue / 100)
          : coupon.discountValue;
        discount = Math.min(discount, subtotal);
      }
    }

    const total = subtotal - discount;
    const customerName = data.customerName?.trim() || undefined;
    const customerEmail = data.customerEmail?.trim() || undefined;
    const customerPhone = data.customerPhone?.trim() || undefined;

    const { orderDoc, ticketRecords } = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber: generateOrderNumber(tenant.parkCode, orderDate),
          orderDate,
          customerName,
          customerEmail,
          customerPhone,
          subtotal,
          discount,
          tax: 0,
          total,
          status: 'completed',
          paymentMethod: data.paymentMethod,
          couponId,
          createdById: req.user!.id,
          source: 'pos',
        },
      });

      const records: Array<{
        ticket: Awaited<ReturnType<typeof tx.ticket.create>>;
        type: (typeof types)[number];
      }> = [];

      for (const item of data.items) {
        const type = typeMap.get(item.ticketTypeId)!;
        for (let i = 0; i < item.quantity; i++) {
          const updatedType = await tx.ticketType.update({
            where: { id: type.id },
            data: { ticketSeq: { increment: 1 } },
          });
          const ticketCode = formatTicketCode(updatedType.slug, updatedType.ticketSeq);
          const qrData = JSON.stringify({ code: ticketCode, tenantId, orderId: order.id });
          const validUntil = new Date(`${orderDate}T23:59:59.999Z`);
          validUntil.setUTCDate(validUntil.getUTCDate() + type.validDays);

          const ticket = await tx.ticket.create({
            data: {
              tenantId,
              orderId: order.id,
              ticketTypeId: type.id,
              ticketCode,
              qrData,
              validUntil,
            },
          });

          records.push({ ticket, type });
        }
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return { orderDoc: order, ticketRecords: records };
    });

    const tickets = await Promise.all(ticketRecords.map(async ({ ticket, type }) => {
      const qrImage = await QRCode.toDataURL(ticket.qrData, { width: 256, margin: 1 });
      return {
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        qrImage,
        ticketTypeName: type.name,
        status: 'valid' as const,
        validUntil: ticket.validUntil,
      };
    }));

    await logAudit({
      tenantId,
      userId: req.user!.id,
      action: 'order.create',
      entityType: 'order',
      entityId: orderDoc.id,
      details: { orderNumber: orderDoc.orderNumber, total, orderDate },
    });

    const emailResult = customerEmail
      ? await sendOrderConfirmation({
          tenantId,
          to: customerEmail,
          parkName: req.tenant!.name,
          customerName: customerName ?? 'Guest',
          orderNumber: orderDoc.orderNumber,
          orderDate,
          total: orderDoc.total,
          paymentMethod: data.paymentMethod,
          tickets: tickets.map((t) => ({
            ticketTypeName: t.ticketTypeName,
            ticketCode: t.ticketCode,
            qrImage: t.qrImage,
          })),
        })
      : { sent: false as const };

    res.status(201).json({
      order: {
        id: orderDoc.id,
        orderNumber: orderDoc.orderNumber,
        orderDate: orderDoc.orderDate,
        customerName: orderDoc.customerName,
        subtotal: orderDoc.subtotal,
        discount: orderDoc.discount,
        tax: orderDoc.tax,
        total: orderDoc.total,
        status: orderDoc.status,
        paymentMethod: orderDoc.paymentMethod,
        createdAt: orderDoc.createdAt,
      },
      tickets,
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

router.get('/orders', requirePermission('orders.view'), async (req, res, next) => {
  try {
    const { date, startDate, endDate, page = '1', limit = '100' } = req.query;
    const tenantId = req.tenant!.id;

    let where: Prisma.OrderWhereInput;

    if (date) {
      const { start, end } = dayBounds(date as string);
      where = {
        tenantId,
        OR: [
          { orderDate: date as string },
          { orderDate: null, createdAt: { gte: start, lte: end } },
        ],
      };
    } else if (startDate || endDate) {
      where = { tenantId, orderDate: {} };
      if (startDate) (where.orderDate as { gte?: string }).gte = String(startDate);
      if (endDate) (where.orderDate as { lte?: string }).lte = String(endDate);
    } else {
      where = { tenantId, orderDate: toDateString() };
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      prisma.order.count({ where }),
    ]);

    const items = await Promise.all(orders.map((o) => mapOrderListItem(o)));
    const summary = await aggregateOrderSummary(where!);

    res.json({
      date: date || null,
      startDate: startDate || null,
      endDate: endDate || null,
      page: pageNum,
      limit: limitNum,
      total,
      summary: {
        totalRevenue: summary.totalRevenue,
        totalOrders: summary.totalOrders,
        totalDiscount: summary.totalDiscount,
      },
      orders: items,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/search', requirePermission('orders.view'), async (req, res, next) => {
  try {
    const { q, limit } = z.object({
      q: z.string().min(2),
      limit: z.string().optional(),
    }).parse(req.query);

    const result = await searchOrders(
      req.tenant!.id,
      q,
      limit ? parseInt(limit, 10) : 50,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', requirePermission('orders.view'), async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: String(req.params.id), tenantId: req.tenant!.id },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(await mapOrderDetail(order));
  } catch (err) {
    next(err);
  }
});

export default router;
