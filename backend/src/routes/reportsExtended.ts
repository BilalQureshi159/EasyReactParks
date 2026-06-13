import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { parseReportRange, reportRangeSchema } from '../utils/reportQuery.js';
import { mapScanLogEntry } from '../utils/scanReports.js';
import {
  aggregateOrderSummary,
  aggregateScanSummary,
  aggregateTicketsByType,
  aggregateTicketsByStatus,
  aggregateBookingsByStatus,
  aggregateMembershipsByPlan,
  aggregateCouponUsage,
  aggregateStaffOrders,
  aggregateAuditByAction,
} from '../utils/reportAggregates.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant, requirePermission('reports.view'));

router.get('/overview', async (req, res, next) => {
  try {
    const range = parseReportRange(reportRangeSchema.parse(req.query));
    const tenantId = req.tenant!.id;
    const orderWhere = {
      tenantId,
      status: 'completed',
      orderDate: { gte: range.startDate, lte: range.endDate },
    };
    const now = new Date();

    const [
      orderSummary,
      scanSummary,
      ticketStatusAgg,
      bookingSummary,
      membershipActive,
      membershipNew,
      couponOrders,
      topTypes,
    ] = await Promise.all([
      aggregateOrderSummary(orderWhere),
      aggregateScanSummary(tenantId, range.start, range.end),
      aggregateTicketsByStatus(tenantId, range.start, range.end),
      aggregateBookingsByStatus(tenantId, range.start, range.end),
      prisma.membership.count({
        where: { tenantId, isActive: true, expiresAt: { gte: now } },
      }),
      prisma.membership.count({
        where: { tenantId, createdAt: { gte: range.start, lte: range.end } },
      }),
      prisma.order.aggregate({
        where: { ...orderWhere, couponId: { not: null } },
        _sum: { discount: true },
        _count: { _all: true },
      }),
      aggregateTicketsByType(tenantId, range.start, range.end, 5),
    ]);

    const ticketStatus = Object.fromEntries(ticketStatusAgg.map((r) => [r.status, r.count]));
    const bookingByStatus: Record<string, { count: number; revenue: number }> = {};
    let bookingTotal = 0;
    let bookingRevenue = 0;
    for (const b of bookingSummary) {
      bookingByStatus[b.status] = { count: b.count, revenue: b.revenue };
      bookingTotal += b.count;
      bookingRevenue += b.revenue;
    }

    const typeIds = topTypes.map((t) => t.ticketTypeId);
    const types = typeIds.length > 0
      ? await prisma.ticketType.findMany({ where: { id: { in: typeIds } } })
      : [];
    const typeMap = Object.fromEntries(types.map((t) => [t.id, t]));

    res.json({
      period: { startDate: range.startDate, endDate: range.endDate },
      revenue: {
        total: orderSummary.totalRevenue,
        orders: orderSummary.totalOrders,
        discount: orderSummary.totalDiscount,
        avgOrder: orderSummary.avgOrderValue,
      },
      attendance: {
        bodyCount: scanSummary.entries,
        denied: scanSummary.denied,
        totalScans: scanSummary.entries + scanSummary.denied,
      },
      tickets: {
        issued: ticketStatusAgg.reduce((s, r) => s + r.count, 0),
        valid: ticketStatus.valid ?? 0,
        used: ticketStatus.used ?? 0,
        expired: ticketStatus.expired ?? 0,
        cancelled: ticketStatus.cancelled ?? 0,
      },
      bookings: {
        total: bookingTotal,
        revenue: bookingRevenue,
        byStatus: bookingByStatus,
      },
      memberships: {
        active: membershipActive,
        newInPeriod: membershipNew,
      },
      coupons: {
        ordersWithCoupon: couponOrders._count._all,
        discountTotal: couponOrders._sum.discount ?? 0,
      },
      topTicketTypes: topTypes.map((t) => ({
        name: typeMap[t.ticketTypeId]?.name ?? 'Unknown',
        color: typeMap[t.ticketTypeId]?.color ?? '#3B82F6',
        count: t.count,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/tickets', async (req, res, next) => {
  try {
    const range = parseReportRange(reportRangeSchema.parse(req.query));
    const tenantId = req.tenant!.id;
    const where = { tenantId, createdAt: { gte: range.start, lte: range.end } };

    const [byType, byStatus, tickets, total] = await Promise.all([
      aggregateTicketsByType(tenantId, range.start, range.end),
      aggregateTicketsByStatus(tenantId, range.start, range.end),
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: {
          ticketType: { select: { name: true, color: true, price: true } },
          order: { select: { orderNumber: true, customerName: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    const typeIds = byType.map((r) => r.ticketTypeId);
    const types = typeIds.length > 0
      ? await prisma.ticketType.findMany({ where: { id: { in: typeIds } } })
      : [];
    const typeMap = Object.fromEntries(types.map((t) => [t.id, t]));

    res.json({
      period: { startDate: range.startDate, endDate: range.endDate },
      summary: {
        total,
        byStatus: byStatus.map((r) => ({ status: r.status, count: r.count })),
      },
      byType: byType.map((r) => ({
        ticketTypeId: r.ticketTypeId,
        name: typeMap[r.ticketTypeId]?.name ?? 'Unknown',
        color: typeMap[r.ticketTypeId]?.color ?? '#3B82F6',
        price: typeMap[r.ticketTypeId]?.price ?? 0,
        count: r.count,
      })),
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketId: t.ticketCode,
        status: t.status,
        ticketTypeName: t.ticketType?.name ?? '—',
        orderNumber: t.order?.orderNumber ?? '—',
        customerName: t.order?.customerName ?? '—',
        validFrom: t.validFrom,
        validUntil: t.validUntil,
        scannedAt: t.scannedAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/bookings', async (req, res, next) => {
  try {
    const range = parseReportRange(reportRangeSchema.parse(req.query));
    const tenantId = req.tenant!.id;
    const where = { tenantId, visitDate: { gte: range.start, lte: range.end } };

    const [byStatus, bookings, summary] = await Promise.all([
      aggregateBookingsByStatus(tenantId, range.start, range.end),
      prisma.booking.findMany({
        where,
        orderBy: { visitDate: 'desc' },
        take: 300,
        include: { ticketType: { select: { name: true } } },
      }),
      prisma.booking.aggregate({
        where,
        _sum: { total: true, quantity: true },
        _count: { _all: true },
      }),
    ]);

    res.json({
      period: { startDate: range.startDate, endDate: range.endDate },
      summary: {
        total: summary._count._all,
        revenue: summary._sum.total ?? 0,
        ticketQuantity: summary._sum.quantity ?? 0,
        byStatus: byStatus.map((r) => ({
          status: r.status,
          count: r.count,
          revenue: r.revenue,
        })),
      },
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        customerName: b.customerName,
        customerEmail: b.customerEmail,
        customerPhone: b.customerPhone,
        visitDate: b.visitDate,
        ticketTypeName: b.ticketType?.name ?? '—',
        quantity: b.quantity,
        total: b.total,
        status: b.status,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/memberships', async (req, res, next) => {
  try {
    const range = parseReportRange(reportRangeSchema.parse(req.query));
    const tenantId = req.tenant!.id;
    const now = new Date();
    const expiringCutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [active, newInPeriod, expiringSoon, byPlan, memberships] = await Promise.all([
      prisma.membership.count({
        where: { tenantId, isActive: true, expiresAt: { gte: now } },
      }),
      prisma.membership.count({
        where: { tenantId, createdAt: { gte: range.start, lte: range.end } },
      }),
      prisma.membership.count({
        where: { tenantId, isActive: true, expiresAt: { gte: now, lte: expiringCutoff } },
      }),
      aggregateMembershipsByPlan(tenantId, now),
      prisma.membership.findMany({
        where: { tenantId, createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: { plan: { select: { name: true, price: true } } },
      }),
    ]);

    const planIds = byPlan.map((p) => p.planId);
    const plans = planIds.length > 0
      ? await prisma.membershipPlan.findMany({ where: { id: { in: planIds } } })
      : [];
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

    res.json({
      period: { startDate: range.startDate, endDate: range.endDate },
      summary: {
        active,
        newInPeriod,
        expiringIn30Days: expiringSoon,
      },
      byPlan: byPlan.map((p) => ({
        planId: p.planId,
        planName: planMap[p.planId]?.name ?? 'Unknown',
        price: planMap[p.planId]?.price ?? 0,
        count: p.count,
      })),
      memberships: memberships.map((m) => ({
        id: m.id,
        memberName: m.memberName,
        memberEmail: m.memberEmail,
        memberCode: m.memberCode,
        planName: m.plan?.name ?? '—',
        startsAt: m.startsAt,
        expiresAt: m.expiresAt,
        isActive: m.isActive,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/coupons', async (req, res, next) => {
  try {
    const range = parseReportRange(reportRangeSchema.parse(req.query));
    const tenantId = req.tenant!.id;

    const [couponUsage, coupons, couponTotals] = await Promise.all([
      aggregateCouponUsage(tenantId, range.startDate, range.endDate),
      prisma.coupon.findMany({ where: { tenantId }, orderBy: { usedCount: 'desc' } }),
      prisma.order.aggregate({
        where: {
          tenantId,
          status: 'completed',
          orderDate: { gte: range.startDate, lte: range.endDate },
          couponId: { not: null },
        },
        _sum: { discount: true },
        _count: { _all: true },
      }),
    ]);

    const couponIds = couponUsage.map((c) => c.couponId);
    const couponDocs = couponIds.length > 0
      ? await prisma.coupon.findMany({ where: { id: { in: couponIds } } })
      : [];
    const couponMap = Object.fromEntries(couponDocs.map((c) => [c.id, c]));

    res.json({
      period: { startDate: range.startDate, endDate: range.endDate },
      summary: {
        ordersWithCoupon: couponTotals._count._all,
        totalDiscount: couponTotals._sum.discount ?? 0,
        activeCoupons: coupons.filter((c) => c.isActive).length,
        totalCoupons: coupons.length,
      },
      usageInPeriod: couponUsage.map((u) => ({
        couponId: u.couponId,
        code: couponMap[u.couponId]?.code ?? '—',
        description: couponMap[u.couponId]?.description ?? '',
        orders: u.orders,
        discount: u.discount,
        revenue: u.revenue,
      })),
      allCoupons: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        usedCount: c.usedCount,
        maxUses: c.maxUses,
        isActive: c.isActive,
        validUntil: c.validUntil,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/staff', async (req, res, next) => {
  try {
    const range = parseReportRange(reportRangeSchema.parse(req.query));
    const tenantId = req.tenant!.id;

    const [byStaffOrders, byStaffScans] = await Promise.all([
      aggregateStaffOrders(tenantId, range.startDate, range.endDate),
      prisma.$queryRaw<
        Array<{ scannedById: string; granted: bigint; denied: bigint }>
      >(Prisma.sql`
        SELECT
          scanned_by_id AS scannedById,
          SUM(CASE WHEN result = 'granted' THEN 1 ELSE 0 END) AS granted,
          SUM(CASE WHEN result = 'denied' THEN 1 ELSE 0 END) AS denied
        FROM scan_logs
        WHERE tenant_id = ${tenantId}
          AND scanned_at >= ${range.start}
          AND scanned_at <= ${range.end}
        GROUP BY scanned_by_id
      `),
    ]);

    const userIds = [
      ...byStaffOrders.map((s) => s.staffId),
      ...byStaffScans.map((s) => s.scannedById),
    ].filter(Boolean);
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, role: true, email: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [
      u.id,
      { name: `${u.firstName} ${u.lastName}`, role: u.role, email: u.email },
    ]));

    const scanMap = Object.fromEntries(byStaffScans.map((s) => [
      s.scannedById,
      { granted: Number(s.granted), denied: Number(s.denied) },
    ]));

    res.json({
      period: { startDate: range.startDate, endDate: range.endDate },
      staff: byStaffOrders.map((s) => {
        const scan = scanMap[s.staffId];
        const user = userMap[s.staffId];
        return {
          staffId: s.staffId,
          staffName: user?.name ?? 'Unknown',
          role: user?.role ?? '',
          email: user?.email ?? '',
          orders: s.orders,
          revenue: s.revenue,
          discount: s.discount,
          scansGranted: scan?.granted ?? 0,
          scansDenied: scan?.denied ?? 0,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-activity', async (req, res, next) => {
  try {
    const range = parseReportRange(reportRangeSchema.parse(req.query));
    const tenantId = req.tenant!.id;
    const limit = Math.min(500, parseInt(String(req.query.limit || '200'), 10));

    const where = {
      tenantId,
      createdAt: { gte: range.start, lte: range.end },
    };

    const [byAction, logs] = await Promise.all([
      aggregateAuditByAction(tenantId, range.start, range.end),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const userIds = logs.map((l) => l.userId).filter((id): id is string => Boolean(id));
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } } })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    res.json({
      period: { startDate: range.startDate, endDate: range.endDate },
      summary: {
        total: logs.length,
        byAction: byAction.map((a) => ({ action: a.action, count: a.count })),
      },
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        details: l.details,
        userName: l.userId ? userMap[l.userId] : null,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
