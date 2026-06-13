import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';
import { BRANDING } from '../config/branding.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import type { UserRole } from '../types/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/admin.js';
import { logAudit } from '../services/audit.js';
import { getPermissionsForUser } from '../services/userPermissions.js';
import { sendPlatformMail } from '../services/email/index.js';

const router = Router();

function buildTokenPayload(user: {
  id: string;
  tenantId?: string | null;
  email: string;
  role: string;
}, impersonatedBy?: string | null) {
  return {
    userId: user.id,
    tenantId: user.tenantId ?? null,
    email: user.email,
    role: user.role as UserRole,
    impersonatedBy: impersonatedBy ?? null,
  };
}

async function issueTokens(user: {
  id: string;
  tenantId?: string | null;
  email: string;
  role: string;
}, impersonatedBy?: string | null) {
  const payload = buildTokenPayload(user, impersonatedBy);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken, payload };
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }).parse(req.body);

    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const tenant = user.tenantId
      ? await prisma.tenant.findUnique({ where: { id: user.tenantId } })
      : null;

    const { accessToken, refreshToken } = await issueTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await logAudit({ tenantId: user.tenantId, userId: user.id, action: 'user.login', ipAddress: req.ip });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
        impersonatedBy: null,
        permissions: await getPermissionsForUser(user.tenantId ?? null, user.role),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const normalized = email.toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: normalized, isActive: true } });

    if (!user) {
      return res.json({ success: true });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const baseUrl = config.corsOrigin.replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;padding:32px;max-width:520px;">
        <h2 style="color:#0c8ce9;">Reset your ${BRANDING.appName} password</h2>
        <p>We received a request to reset the password for <strong>${user.email}</strong>.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0c8ce9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Reset password</a></p>
        <p style="color:#64748b;font-size:14px;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      </div>`;

    const mailResult = await sendPlatformMail(user.email, `Reset your ${BRANDING.appName} password`, html);

    res.json({
      success: true,
      ...(config.nodeEnv === 'development' && {
        resetUrl,
        emailSent: mailResult.sent,
        previewUrl: mailResult.previewUrl,
        emailError: mailResult.error,
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = z.object({
      token: z.string().min(1),
      password: z.string().min(6),
    }).parse(req.body);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!record || !record.user.isActive) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await prisma.refreshToken.findFirst({
      where: {
        userId: payload.userId,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) return res.status(401).json({ error: 'Invalid refresh token' });

    res.json({ accessToken: signAccessToken(payload) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, async (req, res) => {
  await prisma.refreshToken.deleteMany({ where: { userId: req.user!.id } });
  res.json({ success: true });
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tenantId = req.user!.tenantId ?? user.tenantId ?? null;
    const tenant = tenantId
      ? await prisma.tenant.findUnique({ where: { id: tenantId } })
      : null;

    let impersonator: { id: string; email: string; firstName: string; lastName: string } | null = null;
    if (req.user!.impersonatedBy) {
      const admin = await prisma.user.findUnique({ where: { id: req.user!.impersonatedBy } });
      if (admin) {
        impersonator = {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: req.user!.role,
      avatarUrl: user.avatarUrl,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
      impersonatedBy: req.user!.impersonatedBy ?? null,
      impersonator,
      permissions: await getPermissionsForUser(tenantId, req.user!.role),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/impersonate', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { tenantId } = z.object({ tenantId: z.string() }).parse(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Park not found' });
    if (!tenant.isActive) return res.status(400).json({ error: 'Park is inactive' });

    const parkOwner = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: 'park_owner', isActive: true },
    });
    if (!parkOwner) return res.status(404).json({ error: 'No active park owner found for this park' });

    const { accessToken, refreshToken } = await issueTokens(parkOwner, req.user!.id);

    await logAudit({
      tenantId: tenant.id,
      userId: req.user!.id,
      action: 'auth.impersonate',
      entityType: 'user',
      entityId: parkOwner.id,
      details: { parkSlug: tenant.slug, parkName: tenant.name },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: parkOwner.id,
        email: parkOwner.email,
        firstName: parkOwner.firstName,
        lastName: parkOwner.lastName,
        role: 'park_owner',
        avatarUrl: parkOwner.avatarUrl,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        impersonatedBy: req.user!.id,
        impersonator: {
          id: req.user!.id,
          email: req.user!.email,
          firstName: req.user!.firstName,
          lastName: req.user!.lastName,
        },
        permissions: await getPermissionsForUser(tenant.id, 'park_owner'),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
