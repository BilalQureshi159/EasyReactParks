import { Router } from 'express';
import { z } from 'zod';
import type { UserRole } from '../types/index.js';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  PERMISSION_CATALOG,
  PARK_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  getRolesWithPermissions,
  validateRolePermissions,
  validateCustomRolePermissions,
  resolveRolePermissions,
  buildAssignableRoles,
  isBuiltinParkRole,
} from '../permissions/index.js';
import { logAudit } from '../services/audit.js';
import { asTenant, parseRolePermissions } from '../utils/tenantParse.js';
import {
  createParkRole,
  deleteParkRole,
  listParkRoles,
  findParkRoleBySlug,
  updateParkRoleMeta,
  updateParkRolePermissions,
} from '../services/parkRoles.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

router.get('/assignable', requirePermission('staff.view'), async (req, res, next) => {
  try {
    const includeOwner = req.query.includeOwner === 'true';
    const customRoles = await listParkRoles(req.tenant!.id);
    res.json({ roles: buildAssignableRoles(customRoles, includeOwner) });
  } catch (err) {
    next(err);
  }
});

router.get('/', requirePermission('roles.view'), async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

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
      roles: getRolesWithPermissions(asTenant(tenant), customRoles),
      catalog: PERMISSION_CATALOG,
      groups,
      parkRoles: PARK_ROLES,
      defaults: DEFAULT_ROLE_PERMISSIONS,
      assignableForStaff: buildAssignableRoles(customRoles, false),
      assignableForAdmin: buildAssignableRoles(customRoles, true),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/custom', requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1).max(80),
      slug: z.string().regex(/^[a-z][a-z0-9_-]{1,30}$/).optional(),
      description: z.string().max(255).optional(),
      permissions: z.array(z.string()).default([]),
    }).parse(req.body);

    const permissions = validateCustomRolePermissions(data.permissions);
    const role = await createParkRole({
      tenantId: req.tenant!.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      permissions,
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'roles.create',
      entityType: 'park_role',
      entityId: role.id,
      details: { slug: role.slug, name: role.name },
    });

    res.status(201).json({
      role: role.slug,
      name: role.name,
      description: role.description,
      isBuiltin: false,
      permissions,
      isCustomized: true,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/custom/:slug', requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1).max(80).optional(),
      description: z.string().max(255).optional(),
    }).parse(req.body);

    const slug = String(req.params.slug);
    const role = await updateParkRoleMeta(req.tenant!.id, slug, data);

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'roles.update_meta',
      entityType: 'park_role',
      entityId: role.id,
      details: { slug: role.slug, ...data },
    });

    res.json({
      role: role.slug,
      name: role.name,
      description: role.description,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/custom/:slug', requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const slug = String(req.params.slug);
    const existing = await findParkRoleBySlug(req.tenant!.id, slug);
    if (!existing) return res.status(404).json({ error: 'Custom role not found' });

    await deleteParkRole(req.tenant!.id, slug);

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'roles.delete',
      entityType: 'park_role',
      entityId: existing.id,
      details: { slug: existing.slug, name: existing.name },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.put('/:role', requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const role = String(req.params.role);
    const { permissions } = z.object({
      permissions: z.array(z.string()),
    }).parse(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const custom = await findParkRoleBySlug(tenant.id, role);
    if (custom) {
      const validPermissions = validateCustomRolePermissions(permissions);
      const updated = await updateParkRolePermissions(tenant.id, role, validPermissions);

      await logAudit({
        tenantId: req.tenant!.id,
        userId: req.user!.id,
        action: 'roles.update',
        entityType: 'park_role',
        entityId: updated.id,
        details: { role, permissions: validPermissions },
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

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { rolePermissions },
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'roles.update',
      entityType: 'tenant',
      entityId: tenant.id,
      details: { role, permissions: validPermissions },
    });

    res.json({
      role,
      permissions: resolveRolePermissions(asTenant(updatedTenant), role),
      isCustomized: true,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:role/reset', requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const role = String(req.params.role);
    if (!isBuiltinParkRole(role)) {
      return res.status(400).json({ error: 'Only built-in roles can be reset to defaults' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const rolePermissions = parseRolePermissions(tenant.rolePermissions);
    if (rolePermissions[role]) {
      delete rolePermissions[role];
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { rolePermissions },
      });
    }

    const refreshed = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    if (!refreshed) return res.status(404).json({ error: 'Tenant not found' });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'roles.reset',
      entityType: 'tenant',
      entityId: tenant.id,
      details: { role },
    });

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
