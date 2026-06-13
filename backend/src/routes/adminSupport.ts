import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/admin.js';
import {
  mapSupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
} from '../services/support.js';

const router = Router();
router.use(authenticate, requireSuperAdmin);

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

router.get('/meta', (_req, res) => {
  res.json({
    categories: SUPPORT_CATEGORIES,
    priorities: SUPPORT_PRIORITIES,
    statuses: [
      { value: 'open', label: 'Open' },
      { value: 'in_progress', label: 'In progress' },
      { value: 'awaiting_park', label: 'Awaiting park' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'closed', label: 'Closed' },
    ],
  });
});

router.get('/', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      include: ticketInclude,
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });

    res.json(tickets.map(mapSupportTicket));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ticketId = z.string().parse(req.params.id);
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
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

router.patch('/:id', async (req, res, next) => {
  try {
    const ticketId = z.string().parse(req.params.id);
    const data = z.object({
      status: z.enum(['open', 'in_progress', 'awaiting_park', 'resolved', 'closed']).optional(),
      priority: z.string().optional(),
    }).parse(req.body);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: data.status,
        priority: data.priority,
      },
      include: ticketInclude,
    });

    res.json(mapSupportTicket(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/messages', async (req, res, next) => {
  try {
    const ticketId = z.string().parse(req.params.id);
    const { body } = z.object({ body: z.string().min(1).max(10000) }).parse(req.body);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is closed' });

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: req.user!.id,
          authorType: 'platform',
          body,
        },
        include: { author: { select: { firstName: true, lastName: true, email: true, role: true } } },
      });

      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          lastMessageAt: new Date(),
          status: ticket.status === 'resolved' ? 'awaiting_park' : 'awaiting_park',
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
