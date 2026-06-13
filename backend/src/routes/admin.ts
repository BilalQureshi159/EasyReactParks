import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/admin.js';
import { logAudit } from '../services/audit.js';
import { seedDefaultParkData } from '../services/parkOnboarding.js';
import { nextAvailableParkCode } from '../utils/codes.js';
import {
  createParkStaff,
  listParkStaff,
  updateParkStaff,
  ADMIN_STAFF_ROLES,
} from '../services/staff.js';
import { toDateString } from '../utils/date.js';
import {
  PERMISSION_CATALOG,
  PARK_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  getRolesWithPermissions,
  validateRolePermissions,
  validateCustomRolePermissions,
  resolveRolePermissions,
  isBuiltinParkRole,
} from '../permissions/index.js';
import { asTenant, parseRolePermissions } from '../utils/tenantParse.js';
import { listParkRoles, findParkRoleBySlug, updateParkRolePermissions } from '../services/parkRoles.js';
import {
  aggregateOrderSummary,
  aggregateTenantOrders,
  aggregateTenantOrdersToday,
  aggregateUsersByTenant,
} from '../utils/reportAggregates.js';

const router = Router();
router.use(authenticate, requireSuperAdmin);

const domainSchema = z.string().regex(
  /^$|^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
  'Enter a valid domain like tickets.easyticketing.pk'
).optional().or(z.literal(''));

const createParkSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  type: z.string().default('waterpark'),
  currency: z.string().default('USD'),
  timezone: z.string().default('UTC'),
  customDomain: domainSchema,
  seedDefaults: z.boolean().default(true),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().min(1),
  ownerLastName: z.string().min(1),
  ownerPassword: z.string().min(6).optional(),
});

const updateParkSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  customDomain: domainSchema,
  isActive: z.boolean().optional(),
});

const createStaffSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string().min(1),
  password: z.string().min(6).optional(),
});

const updateStaffSchema = z.object({
  role: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
});

function normalizeDomain(domain?: string) {
  const value = domain?.trim().toLowerCase() || '';
  return value || undefined;
}

router.get('/dashboard', async (_req, res, next) => {
  try {
    const todayStr = toDateString();
    const tenants = await prisma.tenant.findMany();
    const tenantIds = tenants.map((t) => t.id);

    const [totals, todayTotals, byPark, todayByPark, staffCounts] = await Promise.all([
      aggregateOrderSummary({ tenantId: { in: tenantIds }, status: 'completed' }),
      aggregateOrderSummary({ tenantId: { in: tenantIds }, status: 'completed', orderDate: todayStr }),
      aggregateTenantOrders(tenantIds),
      aggregateTenantOrdersToday(tenantIds, todayStr),
      aggregateUsersByTenant(tenantIds),
    ]);

    const revenueMap = new Map(byPark.map((r) => [r.tenantId, r]));
    const todayMap = new Map(todayByPark.map((r) => [r.tenantId, r]));
    const staffCount = staffCounts.reduce((sum, r) => sum + r.count, 0);

    res.json({
      kpis: {
        totalParks: tenants.length,
        activeParks: tenants.filter((t) => t.isActive).length,
        totalStaff: staffCount,
        totalRevenue: totals.totalRevenue,
        totalOrders: totals.totalOrders,
        todayRevenue: todayTotals.totalRevenue,
        todayOrders: todayTotals.totalOrders,
      },
      parks: tenants.map((t) => {
        const stats = revenueMap.get(t.id);
        const today = todayMap.get(t.id);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          isActive: t.isActive,
          customDomain: t.customDomain || null,
          revenue: stats?.revenue ?? 0,
          orders: stats?.orders ?? 0,
          todayRevenue: today?.revenue ?? 0,
          todayOrders: today?.orders ?? 0,
        };
      }).sort((a, b) => b.revenue - a.revenue),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/parks', async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
    const tenantIds = tenants.map((t) => t.id);

    const [userCounts, orderCounts, revenueTotals] = await Promise.all([
      aggregateUsersByTenant(tenantIds),
      prisma.order.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds } },
        _count: { _all: true },
      }),
      aggregateTenantOrders(tenantIds),
    ]);

    const usersByTenant = new Map(userCounts.map((r) => [r.tenantId, r.count]));
    const ordersByTenant = new Map(orderCounts.map((r) => [r.tenantId, r._count._all]));
    const revenueByTenant = new Map(revenueTotals.map((r) => [r.tenantId, r.revenue]));

    res.json(tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      type: t.type,
      currency: t.currency,
      timezone: t.timezone,
      customDomain: t.customDomain || null,
      isActive: t.isActive,
      userCount: usersByTenant.get(t.id) ?? 0,
      orderCount: ordersByTenant.get(t.id) ?? 0,
      revenue: revenueByTenant.get(t.id) ?? 0,
      createdAt: t.createdAt,
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/parks/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const [staff, revenue] = await Promise.all([
      listParkStaff(tenant.id),
      aggregateOrderSummary({ tenantId: tenant.id, status: 'completed' }),
    ]);

    res.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      description: tenant.description,
      type: tenant.type,
      currency: tenant.currency,
      timezone: tenant.timezone,
      customDomain: tenant.customDomain || null,
      isActive: tenant.isActive,
      staff,
      stats: {
        revenue: revenue.totalRevenue,
        orders: revenue.totalOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/parks', async (req, res, next) => {
  try {
    const data = createParkSchema.parse(req.body);
    const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) return res.status(409).json({ error: 'Park slug already exists' });

    const customDomain = normalizeDomain(data.customDomain);
    if (customDomain) {
      const domainTaken = await prisma.tenant.findFirst({ where: { customDomain } });
      if (domainTaken) return res.status(409).json({ error: 'Custom domain already in use' });
    }

    const ownerExists = await prisma.user.findFirst({ where: { email: data.ownerEmail.toLowerCase() } });
    if (ownerExists) return res.status(409).json({ error: 'Owner email already in use' });

    const passwordHash = await bcrypt.hash(data.ownerPassword ?? 'Admin123!', 10);
    const existingCodes = await prisma.tenant.findMany({ select: { parkCode: true } });
    const parkCode = await nextAvailableParkCode(existingCodes.map((t) => t.parkCode));

    const { tenant, owner } = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          slug: data.slug,
          parkCode,
          name: data.name,
          description: data.description ?? '',
          type: data.type,
          currency: data.currency,
          timezone: data.timezone,
          customDomain,
          isActive: true,
        },
      });

      const createdOwner = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          email: data.ownerEmail.toLowerCase(),
          passwordHash,
          firstName: data.ownerFirstName,
          lastName: data.ownerLastName,
          role: 'park_owner',
          isActive: true,
        },
      });

      return { tenant: createdTenant, owner: createdOwner };
    });

    if (data.seedDefaults) {
      await seedDefaultParkData(tenant.id, data.type);
    }

    await logAudit({
      userId: req.user!.id,
      action: 'park.create',
      entityType: 'tenant',
      entityId: tenant.id,
      details: { slug: tenant.slug, ownerEmail: owner.email, seedDefaults: data.seedDefaults },
    });

    res.status(201).json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      customDomain: tenant.customDomain || null,
      isActive: tenant.isActive,
      owner: { id: owner.id, email: owner.email },
      seededDefaults: data.seedDefaults,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/parks/:id', async (req, res, next) => {
  try {
    const data = updateParkSchema.parse(req.body);
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const updateData: {
      name?: string;
      description?: string;
      type?: string;
      currency?: string;
      timezone?: string;
      isActive?: boolean;
      customDomain?: string | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.customDomain !== undefined) {
      const customDomain = normalizeDomain(data.customDomain);
      if (customDomain) {
        const domainTaken = await prisma.tenant.findFirst({
          where: { customDomain, id: { not: tenant.id } },
        });
        if (domainTaken) return res.status(409).json({ error: 'Custom domain already in use' });
        updateData.customDomain = customDomain;
      } else {
        updateData.customDomain = null;
      }
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: updateData,
    });

    await logAudit({
      userId: req.user!.id,
      action: data.isActive === false ? 'park.deactivate' : data.isActive === true ? 'park.activate' : 'park.update',
      entityType: 'tenant',
      entityId: tenant.id,
      details: data,
    });

    res.json({
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      customDomain: updated.customDomain || null,
      isActive: updated.isActive,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/parks/:id/staff', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });
    res.json(await listParkStaff(tenant.id));
  } catch (err) {
    next(err);
  }
});

router.post('/parks/:id/staff', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const data = createStaffSchema.parse(req.body);
    const staff = await createParkStaff({
      tenantId: tenant.id,
      ...data,
      allowedRoles: ADMIN_STAFF_ROLES,
    });

    await logAudit({
      tenantId: tenant.id,
      userId: req.user!.id,
      action: 'staff.create',
      entityType: 'user',
      entityId: staff.id,
      details: { email: staff.email, role: staff.role, by: 'super_admin' },
    });

    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
});

router.patch('/parks/:parkId/staff/:userId', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.parkId } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const data = updateStaffSchema.parse(req.body);
    const staff = await updateParkStaff({
      tenantId: tenant.id,
      userId: req.params.userId,
      ...data,
      allowedRoles: ADMIN_STAFF_ROLES,
      actorId: req.user!.id,
    });

    await logAudit({
      tenantId: tenant.id,
      userId: req.user!.id,
      action: 'staff.update',
      entityType: 'user',
      entityId: staff.id,
      details: { ...data, by: 'super_admin' },
    });

    res.json(staff);
  } catch (err) {
    next(err);
  }
});

router.get('/parks/:id/roles', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const customRoles = await listParkRoles(tenant.id);

    const groups = Object.entries(PERMISSION_CATALOG).reduce<Record<string, { key: string; label: string }[]>>(
      (acc, [key, meta]) => {
        if (!acc[meta.group]) acc[meta.group] = [];
        acc[meta.group].push({ key, label: meta.label });
        return acc;
      },
      {},
    );

    res.json({
      parkId: tenant.id,
      parkName: tenant.name,
      roles: getRolesWithPermissions(asTenant(tenant), customRoles),
      catalog: PERMISSION_CATALOG,
      groups,
      parkRoles: PARK_ROLES,
      defaults: DEFAULT_ROLE_PERMISSIONS,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/parks/:id/roles/:role', async (req, res, next) => {
  try {
    const role = req.params.role;
    const { permissions } = z.object({ permissions: z.array(z.string()) }).parse(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const custom = await findParkRoleBySlug(tenant.id, role);
    if (custom) {
      const validPermissions = validateCustomRolePermissions(permissions);
      await updateParkRolePermissions(tenant.id, role, validPermissions);

      await logAudit({
        tenantId: tenant.id,
        userId: req.user!.id,
        action: 'roles.update',
        entityType: 'park_role',
        entityId: custom.id,
        details: { role, permissions: validPermissions, by: 'super_admin' },
      });

      return res.json({
        role,
        permissions: validPermissions,
        isCustomized: true,
      });
    }

    if (!isBuiltinParkRole(role)) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const validPermissions = validateRolePermissions(role, permissions);
    const rolePermissions = parseRolePermissions(tenant.rolePermissions);
    rolePermissions[role] = validPermissions;

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { rolePermissions },
    });

    await logAudit({
      tenantId: tenant.id,
      userId: req.user!.id,
      action: 'roles.update',
      entityType: 'tenant',
      entityId: tenant.id,
      details: { role, permissions: validPermissions, by: 'super_admin' },
    });

    res.json({
      role,
      permissions: resolveRolePermissions(asTenant(updated), role),
      isCustomized: true,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/parks/:id/roles/:role/reset', async (req, res, next) => {
  try {
    const role = req.params.role;
    if (!isBuiltinParkRole(role)) {
      return res.status(400).json({ error: 'Only built-in roles can be reset to defaults' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });

    const rolePermissions = parseRolePermissions(tenant.rolePermissions);
    if (rolePermissions[role]) {
      delete rolePermissions[role];
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { rolePermissions },
      });
    }

    const refreshed = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    if (!refreshed) return res.status(404).json({ error: 'Park not found' });

    res.json({
      role,
      permissions: resolveRolePermissions(asTenant(refreshed), role),
      isCustomized: false,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
