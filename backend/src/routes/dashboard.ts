import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { toDateString } from '../utils/date.js';
import {
  aggregateOrderSummary,
  aggregateOrderRevenueByDate,
  aggregateTicketsByType,
} from '../utils/reportAggregates.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant, requirePermission('dashboard.view'));

function startOfDay(d = new Date()) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.tenant!.id;
    const todayStr = toDateString();
    const yesterdayStr = toDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const weekAgoStr = toDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      todaySummary,
      yesterdaySummary,
      weekOrders,
      monthTickets,
      todayScans,
      todayTicketCount,
    ] = await Promise.all([
      aggregateOrderSummary({ tenantId, status: 'completed', orderDate: todayStr }),
      aggregateOrderSummary({ tenantId, status: 'completed', orderDate: yesterdayStr }),
      aggregateOrderRevenueByDate(tenantId, weekAgoStr, todayStr),
      aggregateTicketsByType(tenantId, monthAgo, new Date(), 5),
      prisma.scanLog.groupBy({
        by: ['result'],
        where: { tenantId, scannedAt: { gte: startOfDay() } },
        _count: { _all: true },
      }),
      prisma.ticket.count({
        where: { tenantId, createdAt: { gte: startOfDay() } },
      }),
    ]);

    const scanMap = Object.fromEntries(todayScans.map((s) => [s.result, s._count._all]));

    const typeIds = monthTickets.map((t) => t.ticketTypeId);
    const types = typeIds.length > 0
      ? await prisma.ticketType.findMany({ where: { id: { in: typeIds } } })
      : [];
    const typeColorMap = Object.fromEntries(types.map((t) => [t.id, { name: t.name, color: t.color }]));

    res.json({
      kpis: {
        revenue: {
          today: todaySummary.totalRevenue,
          yesterday: yesterdaySummary.totalRevenue,
          change: yesterdaySummary.totalRevenue > 0
            ? ((todaySummary.totalRevenue - yesterdaySummary.totalRevenue) / yesterdaySummary.totalRevenue) * 100
            : 0,
        },
        orders: {
          today: todaySummary.totalOrders,
          yesterday: yesterdaySummary.totalOrders,
        },
        visitors: {
          today: todayTicketCount,
          scansGranted: scanMap.granted || 0,
          scansDenied: scanMap.denied || 0,
        },
      },
      revenueChart: weekOrders.map((r) => ({
        date: r.date,
        revenue: r.revenue,
      })),
      topTickets: monthTickets.map((t) => ({
        name: typeColorMap[t.ticketTypeId]?.name || 'Unknown',
        count: t.count,
        color: typeColorMap[t.ticketTypeId]?.color || '#3B82F6',
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
