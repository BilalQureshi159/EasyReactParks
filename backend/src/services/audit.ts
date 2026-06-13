import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export async function logAudit(params: {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: (params.details ?? {}) as Prisma.InputJsonValue,
      ipAddress: params.ipAddress,
    },
  });
}
