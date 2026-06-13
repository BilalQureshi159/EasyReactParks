import { prisma } from '../db/prisma.js';
import { asTenant } from '../utils/tenantParse.js';
import { resolveRolePermissions, ALL_PERMISSIONS } from '../permissions/index.js';
import { listParkRoles } from '../services/parkRoles.js';

export async function getPermissionsForUser(tenantId: string | null, role: string) {
  if (role === 'super_admin') return [...ALL_PERMISSIONS];
  if (!tenantId) return [];
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return [];
  const customRoles = await listParkRoles(tenantId);
  return resolveRolePermissions(asTenant(tenant), role, customRoles);
}
