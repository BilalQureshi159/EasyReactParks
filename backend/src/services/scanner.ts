import { prisma } from '../db/prisma.js';
import { logAudit } from './audit.js';

export function normalizeTicketId(code: string): string {
  return code.trim().toLowerCase();
}

export function ticketCodeVariants(rawCode: string): string[] {
  const trimmed = rawCode.trim();
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();
  const variants = new Set<string>([trimmed, lower, upper]);

  // Legacy T-prefix codes (pre-slug format)
  if (lower.startsWith('t') && lower.length > 1) {
    variants.add(lower.slice(1));
    variants.add(upper.slice(1));
  }

  return Array.from(variants);
}

export function normalizeLookupQuery(query: string): string {
  return query.trim();
}

async function denyTicketScan(
  tenantId: string,
  ticketId: string,
  scannedBy: string,
  message: string,
) {
  await prisma.scanLog.create({
    data: {
      tenantId,
      ticketId,
      scannedById: scannedBy,
      result: 'denied',
      message,
    },
  });
}

type TicketWithType = Awaited<ReturnType<typeof findTicketById>>;

export async function checkInTicket(
  tenantId: string,
  scannedBy: string,
  ticket: NonNullable<TicketWithType>,
) {
  const typeName = ticket.ticketType?.name || 'Ticket';

  if (ticket.status === 'used') {
    await denyTicketScan(tenantId, ticket.id, scannedBy, 'Ticket already used');
    return {
      granted: false,
      message: 'Ticket already used',
      ticket: { ticketId: ticket.ticketCode, ticketTypeName: typeName, status: ticket.status },
    };
  }

  if (ticket.status === 'cancelled' || ticket.status === 'expired') {
    await denyTicketScan(tenantId, ticket.id, scannedBy, `Ticket is ${ticket.status}`);
    return {
      granted: false,
      message: `Ticket is ${ticket.status}`,
      ticket: { ticketId: ticket.ticketCode, ticketTypeName: typeName, status: ticket.status },
    };
  }

  if (ticket.validUntil && ticket.validUntil < new Date()) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'expired' },
    });
    await denyTicketScan(tenantId, ticket.id, scannedBy, 'Ticket expired');
    return {
      granted: false,
      message: 'Ticket expired',
      ticket: { ticketId: ticket.ticketCode, ticketTypeName: typeName, status: 'expired' },
    };
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: 'used',
      scannedAt: new Date(),
      scannedById: scannedBy,
    },
  });

  await prisma.scanLog.create({
    data: {
      tenantId,
      ticketId: ticket.id,
      scannedById: scannedBy,
      result: 'granted',
      message: 'Entry granted',
    },
  });

  await logAudit({
    tenantId,
    userId: scannedBy,
    action: 'ticket.scan',
    entityType: 'ticket',
    entityId: ticket.id,
  });

  return {
    granted: true,
    message: 'Entry granted',
    ticket: { ticketId: ticket.ticketCode, ticketTypeName: typeName, status: 'used' },
  };
}

export async function findTicketById(tenantId: string, rawCode: string) {
  const variants = ticketCodeVariants(rawCode);

  return prisma.ticket.findFirst({
    where: { tenantId, ticketCode: { in: variants } },
    include: { ticketType: { select: { name: true, slug: true } } },
  });
}

export async function lookupOrderByQuery(tenantId: string, query: string) {
  const cleaned = normalizeLookupQuery(query);
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase();

  let order = await prisma.order.findFirst({
    where: { tenantId, orderNumber: cleaned },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  if (!order && /^ET\d{4}-/i.test(cleaned)) {
    order = await prisma.order.findFirst({
      where: { tenantId, orderNumber: upper },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
  }

  if (!order && cleaned.length >= 10) {
    order = await prisma.order.findFirst({
      where: { id: cleaned, tenantId },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
  }

  if (!order) {
    const ticket = await findTicketById(tenantId, cleaned);
    if (ticket) {
      order = await prisma.order.findFirst({
        where: { id: ticket.orderId, tenantId },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      });
    }
  }

  if (!order && cleaned.length >= 4) {
    order = await prisma.order.findFirst({
      where: { tenantId, orderNumber: { contains: cleaned } },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
  }

  if (!order && cleaned.length >= 3) {
    order = await prisma.order.findFirst({
      where: {
        tenantId,
        OR: [
          { customerPhone: { contains: cleaned } },
          { customerName: { contains: cleaned } },
          { customerEmail: { contains: cleaned } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
  }

  return order;
}

export async function bulkCheckInOrder(tenantId: string, scannedBy: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) {
    return { error: 'Order not found' };
  }

  const tickets = await prisma.ticket.findMany({
    where: { tenantId, orderId: order.id },
    include: { ticketType: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const results: {
    ticketId: string;
    ticketTypeName: string;
    granted: boolean;
    message: string;
    status: string;
  }[] = [];

  let grantedCount = 0;
  let deniedCount = 0;

  for (const ticket of tickets) {
    const typeName = ticket.ticketType?.name || 'Ticket';
    const result = await checkInTicket(tenantId, scannedBy, ticket);
    if (result.granted) grantedCount += 1;
    else deniedCount += 1;

    results.push({
      ticketId: ticket.ticketCode,
      ticketTypeName: typeName,
      granted: result.granted,
      message: result.message,
      status: result.ticket?.status ?? ticket.status,
    });
  }

  if (grantedCount > 0) {
    await logAudit({
      tenantId,
      userId: scannedBy,
      action: 'order.bulk_checkin',
      entityType: 'order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, grantedCount, deniedCount },
    });
  }

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      ticketCount: tickets.length,
    },
    grantedCount,
    deniedCount,
    results,
  };
}
