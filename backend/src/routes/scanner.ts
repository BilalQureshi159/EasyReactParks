import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import {
  findTicketById,
  checkInTicket,
  lookupOrderByQuery,
  bulkCheckInOrder,
} from '../services/scanner.js';
import { mapOrderDetail } from '../utils/orders.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant, requirePermission('scanner.use'));

router.post('/validate', async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    const tenantId = req.tenant!.id;
    const scannedBy = req.user!.id;

    const ticket = await findTicketById(tenantId, code);

    if (ticket) {
      const result = await checkInTicket(tenantId, scannedBy, ticket);
      return res.json({
        valid: result.granted,
        type: 'ticket',
        message: result.message,
        ticket: result.ticket
          ? {
              ticketId: result.ticket.ticketId,
              ticketTypeName: result.ticket.ticketTypeName,
              status: result.ticket.status,
            }
          : undefined,
      });
    }

    const member = await prisma.membership.findFirst({
      where: {
        tenantId,
        memberCode: code.trim().toUpperCase(),
      },
      include: { plan: { select: { name: true } } },
    });

    if (member) {
      const planName = member.plan?.name || 'Membership';

      if (!member.isActive || member.expiresAt < new Date()) {
        await prisma.scanLog.create({
          data: {
            tenantId,
            membershipId: member.id,
            scannedById: scannedBy,
            result: 'denied',
            message: 'Membership expired or inactive',
          },
        });
        return res.json({ valid: false, type: 'membership', message: 'Membership expired or inactive' });
      }

      await prisma.scanLog.create({
        data: {
          tenantId,
          membershipId: member.id,
          scannedById: scannedBy,
          result: 'granted',
          message: 'Membership entry granted',
        },
      });
      return res.json({
        valid: true,
        type: 'membership',
        message: 'Entry granted',
        membership: { memberName: member.memberName, planName, expiresAt: member.expiresAt },
      });
    }

    await prisma.scanLog.create({
      data: { tenantId, scannedById: scannedBy, result: 'denied', message: 'Code not found' },
    });
    res.json({ valid: false, type: 'unknown', message: 'Invalid code' });
  } catch (err) {
    next(err);
  }
});

router.post('/order-lookup', async (req, res, next) => {
  try {
    const { query } = z.object({ query: z.string().min(1) }).parse(req.body);
    const tenantId = req.tenant!.id;

    const order = await lookupOrderByQuery(tenantId, query);
    if (!order) {
      return res.status(404).json({ error: 'No order found for that Order ID, Ticket ID, phone, or name' });
    }

    const detail = await mapOrderDetail(order);
    const validCount = detail.tickets.filter((t) => t.status === 'valid').length;
    const usedCount = detail.tickets.filter((t) => t.status === 'used').length;

    res.json({
      ...detail,
      summary: {
        validCount,
        usedCount,
        totalTickets: detail.tickets.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/checkin-order', async (req, res, next) => {
  try {
    const body = z.object({
      orderId: z.string().optional(),
      query: z.string().optional(),
    }).refine((d) => d.orderId || d.query, { message: 'orderId or query required' }).parse(req.body);

    const tenantId = req.tenant!.id;
    const scannedBy = req.user!.id;

    let orderId = body.orderId;
    if (!orderId && body.query) {
      const order = await lookupOrderByQuery(tenantId, body.query);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      orderId = order.id;
    }

    const result = await bulkCheckInOrder(tenantId, scannedBy, orderId!);
    if ('error' in result && result.error) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const logs = await prisma.scanLog.findMany({
      where: { tenantId: req.tenant!.id },
      orderBy: { scannedAt: 'desc' },
      take: 100,
      include: {
        scannedBy: { select: { firstName: true, lastName: true } },
        ticket: {
          select: {
            ticketCode: true,
            ticketType: { select: { name: true } },
          },
        },
        membership: { select: { memberName: true, memberCode: true } },
      },
    });

    res.json(logs.map((l) => {
      const ticketTypeName = l.ticket?.ticketType?.name;
      const guestLabel = ticketTypeName ?? l.membership?.memberName ?? '—';
      const ticketId = l.ticket?.ticketCode ?? l.membership?.memberCode ?? null;

      return {
        id: l.id,
        result: l.result,
        message: l.message ?? '',
        scannedAt: l.scannedAt,
        guestLabel,
        ticketId,
        scannedByName: l.scannedBy
          ? `${l.scannedBy.firstName} ${l.scannedBy.lastName}`
          : 'Unknown',
      };
    }));
  } catch (err) {
    next(err);
  }
});

export default router;
