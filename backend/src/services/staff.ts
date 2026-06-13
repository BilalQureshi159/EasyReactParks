import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import type { UserRole } from '../types/index.js';
import { isAssignableParkRole } from './parkRoles.js';

export const PARK_STAFF_ROLES: UserRole[] = ['manager', 'cashier', 'gate_staff'];
export const ADMIN_STAFF_ROLES: UserRole[] = ['park_owner', 'manager', 'cashier', 'gate_staff'];

export function mapStaffUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function listParkStaff(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
  return users.map(mapStaffUser);
}

async function assertAssignableRole(tenantId: string, role: string, allowedBuiltin: UserRole[]) {
  if (allowedBuiltin.includes(role as UserRole)) return;
  const ok = await isAssignableParkRole(tenantId, role);
  if (!ok) {
    throw Object.assign(new Error('Invalid role for this account'), { statusCode: 400 });
  }
}

export async function createParkStaff(params: {
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password?: string;
  allowedRoles: UserRole[];
}) {
  await assertAssignableRole(params.tenantId, params.role, params.allowedRoles);

  const email = params.email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(params.password ?? 'Admin123!', 10);
  const user = await prisma.user.create({
    data: {
      tenantId: params.tenantId,
      email,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      isActive: true,
    },
  });

  return mapStaffUser(user);
}

export async function updateParkStaff(params: {
  tenantId: string;
  userId: string;
  role?: string;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
  password?: string;
  allowedRoles: UserRole[];
  actorId: string;
}) {
  const user = await prisma.user.findFirst({
    where: { id: params.userId, tenantId: params.tenantId },
  });
  if (!user) throw Object.assign(new Error('Staff member not found'), { statusCode: 404 });

  if (user.id === params.actorId && params.isActive === false) {
    throw Object.assign(new Error('You cannot deactivate your own account'), { statusCode: 400 });
  }

  if (params.role !== undefined) {
    await assertAssignableRole(params.tenantId, params.role, params.allowedRoles);
    if (user.role === 'park_owner' && params.role !== 'park_owner' && user.id === params.actorId) {
      throw Object.assign(new Error('You cannot change your own owner role'), { statusCode: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: params.role,
      isActive: params.isActive,
      firstName: params.firstName,
      lastName: params.lastName,
      ...(params.password ? { passwordHash: await bcrypt.hash(params.password, 10) } : {}),
    },
  });

  return mapStaffUser(updated);
}
