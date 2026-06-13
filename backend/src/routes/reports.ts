import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { toDateString, parseDateRange } from '../utils/date.js';
import { mapOrderListItem } from '../utils/orders.js';
import { mapScanLogEntry } from '../utils/scanReports.js';
import {
  aggregateOrderRevenueByDate,
  aggregateOrdersByField,
  aggregateOrderSummary,
  aggregateScanSummary,
  aggregateScansByDay,
  aggregateScansByStaff,
  countUniqueGrantedTickets,
} from '../utils/reportAggregates.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant, requirePermission('reports.view'));

router.get('/revenue', async (req, res, next) => {
  try {
    const { startDate, endDate } = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).parse(req.query);

    const start = startDate || toDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const end = endDate || toDateString();
    const tenantId = req.tenant!.id;

    const [daily, byPayment, bySource] = await Promise.all([
      aggregateOrderRevenueByDate(tenantId, start, end),
      aggregateOrdersByField(tenantId, start, end, 'paymentMethod'),
      aggregateOrdersByField(tenantId, start, end, 'source'),
    ]);

    res.json({
      period: { start, end },
      daily: daily.map((d) => ({
        date: d.date,
        orders: d.orders,
        revenue: d.revenue,
        subtotal: d.subtotal,
        discount: d.discount,
      })),
      byPayment: byPayment.map((p) => ({
        method: p.key,
        count: p.count,
        revenue: p.revenue,
      })),
      bySource: bySource.map((s) => ({
        source: s.key,
        count: s.count,
        revenue: s.revenue,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sales', async (req, res, next) => {
  try {
    const { date, startDate, endDate } = z.object({
      date: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).parse(req.query);

    const tenantId = req.tenant!.id;
    const where: {
      tenantId: string;
      status: string;
      orderDate?: string | { gte: string; lte: string };
    } = {
      tenantId,
      status: 'completed',
    };

    if (date) {
      where.orderDate = date;
    } else {
      where.orderDate = {
        gte: startDate || toDateString(),
        lte: endDate || toDateString(),
      };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });

    const items = await Promise.all(orders.map((o) => mapOrderListItem(o)));
    const summary = await aggregateOrderSummary(where);

    res.json({
      period: {
        date: date || null,
        startDate: date ? date : (startDate || toDateString()),
        endDate: date ? date : (endDate || toDateString()),
      },
      summary: {
        totalRevenue: summary.totalRevenue,
        totalOrders: summary.totalOrders,
        totalDiscount: summary.totalDiscount,
        avgOrderValue: summary.avgOrderValue,
      },
      orders: items,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/attendance', async (req, res, next) => {
  try {
    const { startDate, endDate } = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).parse(req.query);

    const { start, end } = parseDateRange(undefined, startDate, endDate);
    const tenantId = req.tenant!.id;

    const daily = await aggregateScansByDay(tenantId, start, end);
    res.json(daily);
  } catch (err) {
    next(err);
  }
});

router.get('/scans', async (req, res, next) => {
  try {
    const query = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      result: z.enum(['granted', 'denied']).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }).parse(req.query);

    const { start, end, singleDate } = parseDateRange(query.date, query.startDate, query.endDate);
    const tenantId = req.tenant!.id;
    const pageNum = Math.max(1, parseInt(query.page || '1', 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(query.limit || '200', 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: {
      tenantId: string;
      scannedAt: { gte: Date; lte: Date };
      result?: string;
    } = {
      tenantId,
      scannedAt: { gte: start, lte: end },
    };
    if (query.result) where.result = query.result;

    const [summaryRow, daily, staffAgg, uniqueTickets, logs, total] = await Promise.all([
      aggregateScanSummary(tenantId, start, end),
      aggregateScansByDay(tenantId, start, end),
      aggregateScansByStaff(tenantId, start, end),
      countUniqueGrantedTickets(tenantId, start, end),
      prisma.scanLog.findMany({
        where,
        orderBy: { scannedAt: 'desc' },
        skip,
        take: limitNum,
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
      }),
      prisma.scanLog.count({ where }),
    ]);

    const staffIds = staffAgg.map((s) => s.staffId);
    const staffUsers = staffIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const staffNameMap = new Map(staffUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        date: singleDate,
        startDate: singleDate ?? query.startDate ?? toDateString(start),
        endDate: singleDate ?? query.endDate ?? toDateString(end),
      },
      summary: {
        bodyCount: summaryRow.entries,
        totalScans: summaryRow.totalScans,
        entries: summaryRow.entries,
        denied: summaryRow.denied,
        ticketEntries: summaryRow.ticketEntries,
        membershipEntries: summaryRow.membershipEntries,
        uniqueTickets,
      },
      daily,
      byStaff: staffAgg.map((s) => ({
        staffId: s.staffId,
        staffName: staffNameMap.get(s.staffId) ?? 'Unknown',
        granted: s.granted,
        denied: s.denied,
        total: s.total,
      })),
      page: pageNum,
      limit: limitNum,
      total,
      logs: logs.map((log) => mapScanLogEntry({
        id: log.id,
        result: log.result,
        message: log.message,
        scannedAt: log.scannedAt,
        scannedBy: log.scannedBy,
        ticket: log.ticket,
        membership: log.membership,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
