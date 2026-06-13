import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { asTenant } from '../utils/tenantParse.js';
import { roleHasPermission, type Permission } from '../permissions/index.js';
import { listParkRoles } from '../services/parkRoles.js';

export function requirePermission(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'super_admin' && !req.user.impersonatedBy) {
      return next();
    }

    if (!req.tenant) return res.status(400).json({ error: 'Tenant context required' });

    const tenantRow = await prisma.tenant.findUnique({ where: { id: req.tenant.id } });
    const tenant = tenantRow ? asTenant(tenantRow) : null;
    const customRoles = await listParkRoles(req.tenant.id);
    const allowed = permissions.some((p) =>
      roleHasPermission(tenant, req.user!.role, p, customRoles),
    );

    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
