import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { ISmtpSettings } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { resolveTenant, requireTenant } from '../middleware/tenant.js';
import { requirePermission } from '../middleware/permissions.js';
import { sendTestEmail } from '../services/email/index.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const defaultSmtp: ISmtpSettings = {
  enabled: false,
  from: '',
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
};

const smtpSchema = z.object({
  enabled: z.boolean(),
  from: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean(),
  user: z.string().min(1),
  pass: z.string().optional(),
});

function mapSmtpResponse(smtp: ISmtpSettings) {
  return {
    enabled: smtp.enabled,
    from: smtp.from,
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
    hasPassword: Boolean(smtp.pass),
  };
}

router.get('/smtp', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const smtp = (tenant.smtp as ISmtpSettings | null) ?? defaultSmtp;

    res.json({
      smtp: mapSmtpResponse(smtp),
      parkName: tenant.name,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/smtp', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const data = smtpSchema.parse(req.body);
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const currentSmtp = (tenant.smtp as ISmtpSettings | null) ?? defaultSmtp;
    const updatedSmtp: ISmtpSettings = {
      enabled: data.enabled,
      from: data.from,
      host: data.host,
      port: data.port,
      secure: data.secure,
      user: data.user,
      pass: data.pass || currentSmtp.pass || '',
    };

    if (data.enabled && !updatedSmtp.pass) {
      return res.status(400).json({ error: 'SMTP password is required when email is enabled' });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { smtp: updatedSmtp as unknown as Prisma.InputJsonValue },
    });

    await logAudit({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'settings.smtp.update',
      entityType: 'tenant',
      entityId: tenant.id,
    });

    const smtp = (updated.smtp as ISmtpSettings | null) ?? defaultSmtp;
    res.json({ smtp: mapSmtpResponse(smtp), parkName: updated.name });
  } catch (err) {
    next(err);
  }
});

const parkSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  customDomain: z.string().regex(
    /^$|^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    'Enter a valid domain like tickets.easyticketing.pk'
  ).optional().or(z.literal('')),
});

router.get('/park', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    res.json({
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      customDomain: tenant.customDomain || '',
      bookingUrl: `/book/${tenant.slug}`,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/park', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const data = parkSchema.parse(req.body);
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const updateData: {
      name?: string;
      description?: string;
      customDomain?: string | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    if (data.customDomain !== undefined) {
      const customDomain = data.customDomain.trim().toLowerCase() || null;
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
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      action: 'settings.park.update',
      entityType: 'tenant',
      entityId: tenant.id,
    });

    res.json({
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      customDomain: updated.customDomain || '',
      bookingUrl: `/book/${updated.slug}`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/smtp/test', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const { to } = z.object({ to: z.string().email() }).parse(req.body);
    const result = await sendTestEmail(req.tenant!.id, to, req.tenant!.name);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
