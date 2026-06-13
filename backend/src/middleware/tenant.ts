import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  const tenantId = req.user.tenantId;

  if (!tenantId) {
    if (req.user.role === 'super_admin') {
      const slug = req.headers['x-tenant-slug'] as string | undefined;
      if (slug) {
        const tenant = await prisma.tenant.findFirst({ where: { slug, isActive: true } });
        if (tenant) {
          req.tenant = {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            currency: tenant.currency,
            timezone: tenant.timezone,
          };
        }
      }
      return next();
    }
    return res.status(403).json({ error: 'No tenant associated with user' });
  }

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, isActive: true } });
  if (!tenant) return res.status(403).json({ error: 'Tenant not found or inactive' });

  req.tenant = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    currency: tenant.currency,
    timezone: tenant.timezone,
  };

  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) return res.status(400).json({ error: 'Tenant context required' });
  next();
}
