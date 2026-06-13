import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export async function aggregateOrderRevenueByDate(
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const rows = await prisma.order.groupBy({
    by: ['orderDate'],
    where: {
      tenantId,
      status: 'completed',
      orderDate: { gte: startDate, lte: endDate },
    },
    _sum: { total: true, subtotal: true, discount: true },
    _count: { _all: true },
    orderBy: { orderDate: 'asc' },
  });

  return rows.map((r) => ({
    date: r.orderDate ?? '',
    orders: r._count._all,
    revenue: r._sum.total ?? 0,
    subtotal: r._sum.subtotal ?? 0,
    discount: r._sum.discount ?? 0,
  }));
}

export async function aggregateOrdersByField(
  tenantId: string,
  startDate: string,
  endDate: string,
  field: 'paymentMethod' | 'source',
) {
  const rows = await prisma.order.groupBy({
    by: [field],
    where: {
      tenantId,
      status: 'completed',
      orderDate: { gte: startDate, lte: endDate },
    },
    _sum: { total: true },
    _count: { _all: true },
  });

  return rows.map((r) => ({
    key: r[field] ?? 'unknown',
    count: r._count._all,
    revenue: r._sum.total ?? 0,
  }));
}

export async function aggregateOrderSummary(where: Prisma.OrderWhereInput) {
  const result = await prisma.order.aggregate({
    where,
    _sum: { total: true, discount: true },
    _count: { _all: true },
    _avg: { total: true },
  });

  return {
    totalRevenue: result._sum.total ?? 0,
    totalOrders: result._count._all,
    totalDiscount: result._sum.discount ?? 0,
    avgOrderValue: result._avg.total ?? 0,
  };
}

export async function aggregateScanSummary(
  tenantId: string,
  start: Date,
  end: Date,
) {
  const rows = await prisma.$queryRaw<
    Array<{
      totalScans: bigint;
      entries: bigint;
      denied: bigint;
      ticketEntries: bigint;
      membershipEntries: bigint;
    }>
  >(Prisma.sql`
    SELECT
      COUNT(*) AS totalScans,
      SUM(CASE WHEN result = 'granted' THEN 1 ELSE 0 END) AS entries,
      SUM(CASE WHEN result = 'denied' THEN 1 ELSE 0 END) AS denied,
      SUM(CASE WHEN result = 'granted' AND ticket_id IS NOT NULL THEN 1 ELSE 0 END) AS ticketEntries,
      SUM(CASE WHEN result = 'granted' AND membership_id IS NOT NULL THEN 1 ELSE 0 END) AS membershipEntries
    FROM scan_logs
    WHERE tenant_id = ${tenantId}
      AND scanned_at >= ${start}
      AND scanned_at <= ${end}
  `);

  const row = rows[0];
  return {
    totalScans: Number(row?.totalScans ?? 0),
    entries: Number(row?.entries ?? 0),
    denied: Number(row?.denied ?? 0),
    ticketEntries: Number(row?.ticketEntries ?? 0),
    membershipEntries: Number(row?.membershipEntries ?? 0),
  };
}

export async function aggregateScansByDay(
  tenantId: string,
  start: Date,
  end: Date,
) {
  const rows = await prisma.$queryRaw<
    Array<{ day: string; result: string; count: bigint }>
  >(Prisma.sql`
    SELECT DATE(scanned_at) AS day, result, COUNT(*) AS count
    FROM scan_logs
    WHERE tenant_id = ${tenantId}
      AND scanned_at >= ${start}
      AND scanned_at <= ${end}
    GROUP BY DATE(scanned_at), result
    ORDER BY day ASC
  `);

  const byDate: Record<string, { entries: number; denied: number }> = {};
  for (const row of rows) {
    const d = row.day;
    if (!byDate[d]) byDate[d] = { entries: 0, denied: 0 };
    if (row.result === 'granted') byDate[d].entries = Number(row.count);
    else if (row.result === 'denied') byDate[d].denied = Number(row.count);
  }

  return Object.entries(byDate)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function aggregateScansByStaff(
  tenantId: string,
  start: Date,
  end: Date,
) {
  const rows = await prisma.$queryRaw<
    Array<{ scannedById: string; granted: bigint; denied: bigint; total: bigint }>
  >(Prisma.sql`
    SELECT
      scanned_by_id AS scannedById,
      SUM(CASE WHEN result = 'granted' THEN 1 ELSE 0 END) AS granted,
      SUM(CASE WHEN result = 'denied' THEN 1 ELSE 0 END) AS denied,
      COUNT(*) AS total
    FROM scan_logs
    WHERE tenant_id = ${tenantId}
      AND scanned_at >= ${start}
      AND scanned_at <= ${end}
    GROUP BY scanned_by_id
    ORDER BY total DESC
  `);

  return rows.map((r) => ({
    staffId: r.scannedById,
    granted: Number(r.granted),
    denied: Number(r.denied),
    total: Number(r.total),
  }));
}

export async function countUniqueGrantedTickets(
  tenantId: string,
  start: Date,
  end: Date,
) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT ticket_id) AS count
    FROM scan_logs
    WHERE tenant_id = ${tenantId}
      AND scanned_at >= ${start}
      AND scanned_at <= ${end}
      AND result = 'granted'
      AND ticket_id IS NOT NULL
  `);
  return Number(rows[0]?.count ?? 0);
}

export async function aggregateTicketsByType(
  tenantId: string,
  start: Date,
  end: Date,
  limit?: number,
) {
  const rows = await prisma.ticket.groupBy({
    by: ['ticketTypeId'],
    where: { tenantId, createdAt: { gte: start, lte: end } },
    _count: { _all: true },
    orderBy: { _count: { ticketTypeId: 'desc' } },
    ...(limit ? { take: limit } : {}),
  });

  return rows.map((r) => ({
    ticketTypeId: r.ticketTypeId,
    count: r._count._all,
  }));
}

export async function aggregateTicketsByStatus(
  tenantId: string,
  start: Date,
  end: Date,
) {
  const rows = await prisma.ticket.groupBy({
    by: ['status'],
    where: { tenantId, createdAt: { gte: start, lte: end } },
    _count: { _all: true },
  });

  return rows.map((r) => ({ status: r.status, count: r._count._all }));
}

export async function aggregateBookingsByStatus(
  tenantId: string,
  start: Date,
  end: Date,
) {
  const rows = await prisma.booking.groupBy({
    by: ['status'],
    where: { tenantId, visitDate: { gte: start, lte: end } },
    _sum: { total: true },
    _count: { _all: true },
  });

  return rows.map((r) => ({
    status: r.status,
    count: r._count._all,
    revenue: r._sum.total ?? 0,
  }));
}

export async function aggregateMembershipsByPlan(tenantId: string, now: Date) {
  const rows = await prisma.membership.groupBy({
    by: ['planId'],
    where: { tenantId, isActive: true, expiresAt: { gte: now } },
    _count: { _all: true },
    orderBy: { _count: { planId: 'desc' } },
  });

  return rows.map((r) => ({ planId: r.planId, count: r._count._all }));
}

export async function aggregateCouponUsage(
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const rows = await prisma.order.groupBy({
    by: ['couponId'],
    where: {
      tenantId,
      status: 'completed',
      orderDate: { gte: startDate, lte: endDate },
      couponId: { not: null },
    },
    _sum: { discount: true, total: true },
    _count: { _all: true },
    orderBy: { _count: { couponId: 'desc' } },
  });

  return rows
    .filter((r) => r.couponId)
    .map((r) => ({
      couponId: r.couponId!,
      orders: r._count._all,
      discount: r._sum.discount ?? 0,
      revenue: r._sum.total ?? 0,
    }));
}

export async function aggregateStaffOrders(
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const rows = await prisma.order.groupBy({
    by: ['createdById'],
    where: {
      tenantId,
      status: 'completed',
      orderDate: { gte: startDate, lte: endDate },
      createdById: { not: null },
    },
    _sum: { total: true, discount: true },
    _count: { _all: true },
    orderBy: { _sum: { total: 'desc' } },
  });

  return rows
    .filter((r) => r.createdById)
    .map((r) => ({
      staffId: r.createdById!,
      orders: r._count._all,
      revenue: r._sum.total ?? 0,
      discount: r._sum.discount ?? 0,
    }));
}

export async function aggregateAuditByAction(
  tenantId: string,
  start: Date,
  end: Date,
) {
  const rows = await prisma.auditLog.groupBy({
    by: ['action'],
    where: { tenantId, createdAt: { gte: start, lte: end } },
    _count: { _all: true },
    orderBy: { _count: { action: 'desc' } },
  });

  return rows.map((r) => ({ action: r.action, count: r._count._all }));
}

export async function aggregateTenantOrders(tenantIds: string[]) {
  if (tenantIds.length === 0) return [];

  const rows = await prisma.order.groupBy({
    by: ['tenantId'],
    where: { tenantId: { in: tenantIds }, status: 'completed' },
    _sum: { total: true },
    _count: { _all: true },
  });

  return rows.map((r) => ({
    tenantId: r.tenantId,
    revenue: r._sum.total ?? 0,
    orders: r._count._all,
  }));
}

export async function aggregateTenantOrdersToday(tenantIds: string[], todayStr: string) {
  if (tenantIds.length === 0) return [];

  const rows = await prisma.order.groupBy({
    by: ['tenantId'],
    where: { tenantId: { in: tenantIds }, status: 'completed', orderDate: todayStr },
    _sum: { total: true },
    _count: { _all: true },
  });

  return rows.map((r) => ({
    tenantId: r.tenantId,
    revenue: r._sum.total ?? 0,
    orders: r._count._all,
  }));
}

export async function aggregateUsersByTenant(tenantIds: string[]) {
  if (tenantIds.length === 0) return [];

  const rows = await prisma.user.groupBy({
    by: ['tenantId'],
    where: { tenantId: { in: tenantIds } },
    _count: { _all: true },
  });

  return rows
    .filter((r) => r.tenantId)
    .map((r) => ({ tenantId: r.tenantId!, count: r._count._all }));
}
