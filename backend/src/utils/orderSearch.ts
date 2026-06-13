import { prisma } from '../db/prisma.js';
import { mapOrderListItem } from './orders.js';
import { ticketCodeVariants } from '../services/scanner.js';

export async function searchOrders(tenantId: string, query: string, limit = 50) {
  const cleaned = query.trim();
  if (cleaned.length < 2) {
    return { orders: [], total: 0 };
  }

  const orConditions: Record<string, unknown>[] = [
    { orderNumber: { contains: cleaned } },
    { customerName: { contains: cleaned } },
    { customerEmail: { contains: cleaned } },
    { customerPhone: { contains: cleaned } },
  ];

  if (cleaned.length >= 10) {
    orConditions.push({ id: cleaned });
  }

  const ticketVariants = ticketCodeVariants(cleaned);

  const matchingTickets = await prisma.ticket.findMany({
    where: { tenantId, ticketCode: { in: ticketVariants } },
    select: { orderId: true },
    take: 30,
  });

  const orderIdsFromTickets = matchingTickets.map((t) => t.orderId);
  if (orderIdsFromTickets.length > 0) {
    orConditions.push({ id: { in: orderIdsFromTickets } });
  }

  const limitNum = Math.min(100, Math.max(1, limit));

  const orders = await prisma.order.findMany({
    where: { tenantId, OR: orConditions as never },
    orderBy: { createdAt: 'desc' },
    take: limitNum,
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  const items = await Promise.all(orders.map((o) => mapOrderListItem(o)));

  return {
    orders: items,
    total: items.length,
    query: cleaned,
  };
}
