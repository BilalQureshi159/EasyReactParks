import type { IOrder } from '../models/index.js';
import { prisma } from '../db/prisma.js';
import { toDateString } from './date.js';

type OrderWithCreator = IOrder & {
  createdBy?: { firstName: string; lastName: string } | null;
};

export async function mapOrderListItem(o: OrderWithCreator) {
  const ticketCount = await prisma.ticket.count({ where: { orderId: o.id } });
  const creator = o.createdBy;

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    orderDate: o.orderDate || toDateString(o.createdAt),
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    subtotal: o.subtotal,
    discount: o.discount,
    tax: o.tax,
    total: o.total,
    status: o.status,
    paymentMethod: o.paymentMethod,
    source: o.source,
    ticketCount,
    createdByName: creator ? `${creator.firstName} ${creator.lastName}` : null,
    createdAt: o.createdAt,
  };
}

export async function mapOrderDetail(o: OrderWithCreator) {
  const creator = o.createdBy;
  const tickets = await prisma.ticket.findMany({
    where: { orderId: o.id },
    orderBy: { createdAt: 'asc' },
    include: { ticketType: { select: { id: true, name: true, price: true, color: true, category: true } } },
  });

  let couponCode: string | null = null;
  if (o.couponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: o.couponId },
      select: { code: true },
    });
    couponCode = coupon?.code ?? null;
  }

  const lineItemMap = new Map<string, {
    ticketTypeId: string;
    ticketTypeName: string;
    price: number;
    color: string;
    quantity: number;
  }>();

  const ticketItems = tickets.map((t) => {
    const type = t.ticketType;
    const typeId = type?.id ?? '';
    const typeName = type?.name ?? 'Ticket';
    const price = type?.price ?? 0;
    const color = type?.color ?? '#3B82F6';

    if (typeId) {
      const existing = lineItemMap.get(typeId);
      if (existing) {
        existing.quantity += 1;
      } else {
        lineItemMap.set(typeId, {
          ticketTypeId: typeId,
          ticketTypeName: typeName,
          price,
          color,
          quantity: 1,
        });
      }
    }

    return {
      id: t.id,
      ticketCode: t.ticketCode,
      ticketTypeName: typeName,
      ticketTypeColor: color,
      status: t.status,
      validFrom: t.validFrom,
      validUntil: t.validUntil,
      scannedAt: t.scannedAt,
    };
  });

  return {
    order: {
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate || toDateString(o.createdAt),
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      subtotal: o.subtotal,
      discount: o.discount,
      tax: o.tax,
      total: o.total,
      status: o.status,
      paymentMethod: o.paymentMethod,
      source: o.source,
      couponCode,
      createdByName: creator ? `${creator.firstName} ${creator.lastName}` : null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    },
    lineItems: Array.from(lineItemMap.values()),
    tickets: ticketItems,
  };
}
