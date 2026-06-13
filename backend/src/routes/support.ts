import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  mapSupportTicket,
  nextSupportTicketNumber,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
} from '../services/support.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const ticketInclude = {
  tenant: { select: { name: true, slug: true } },
  createdBy: { select: { firstName: true, lastName: true, email: true } },
};

function mapMessage(msg: {
  id: string;
  body: string;
  authorType: string;
  createdAt: Date;
  author: { firstName: string; lastName: string; email: string; role: string };
}) {
  return {
    id: msg.id,
    body: msg.body,
    authorType: msg.authorType,
    createdAt: msg.createdAt,
    authorName: `${msg.author.firstName} ${msg.author.lastName}`,
    authorEmail: msg.author.email,
    authorRole: msg.author.role,
  };
}

router.get('/meta', requirePermission('support.view'), (_req, res) => {
  res.json({ categories: SUPPORT_CATEGORIES, priorities: SUPPORT_PRIORITIES });
});

router.get('/', requirePermission('support.view'), async (req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { tenantId: req.tenant!.id },
      include: ticketInclude,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    res.json(tickets.map(mapSupportTicket));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('support.create'), async (req, res, next) => {
  try {
    const data = z.object({
      subject: z.string().min(3).max(200),
      category: z.string().min(1),
      priority: z.string().min(1),
      description: z.string().min(10).max(10000),
      contactName: z.string().min(1),
      contactEmail: z.string().email(),
      contactPhone: z.string().optional(),
      browserInfo: z.string().max(512).optional(),
      pageUrl: z.string().max(512).optional(),
    }).parse(req.body);

    const ticketNumber = await nextSupportTicketNumber(req.tenant!.id);

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: req.tenant!.id,
        ticketNumber,
        subject: data.subject,
        category: data.category,
        priority: data.priority,
        status: 'open',
        description: data.description,
        contactName: data.contactName,
        contactEmail: data.contactEmail.toLowerCase(),
        contactPhone: data.contactPhone,
        browserInfo: data.browserInfo,
        pageUrl: data.pageUrl,
        createdById: req.user!.id,
        messages: {
          create: {
            authorId: req.user!.id,
            authorType: 'park',
            body: data.description,
          },
        },
      },
      include: ticketInclude,
    });

    res.status(201).json(mapSupportTicket(ticket));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('support.view'), async (req, res, next) => {
  try {
    const ticketId = z.string().parse(req.params.id);
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId: req.tenant!.id },
      include: {
        tenant: { select: { name: true, slug: true } },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { firstName: true, lastName: true, email: true, role: true } } },
        },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    res.json({
      ...mapSupportTicket(ticket),
      messages: ticket.messages.map(mapMessage),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/messages', requirePermission('support.create'), async (req, res, next) => {
  try {
    const ticketId = z.string().parse(req.params.id);
    const { body } = z.object({ body: z.string().min(1).max(10000) }).parse(req.body);

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId: req.tenant!.id },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is closed' });

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: req.user!.id,
          authorType: 'park',
          body,
        },
        include: { author: { select: { firstName: true, lastName: true, email: true, role: true } } },
      });

      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          lastMessageAt: new Date(),
          status: ticket.status === 'awaiting_park' ? 'open' : ticket.status,
        },
      });

      return msg;
    });

    res.status(201).json(mapMessage(message));
  } catch (err) {
    next(err);
  }
});

export default router;
