import { prisma } from '../db/prisma.js';
import type { Permission } from '../permissions/index.js';
import { ALL_PERMISSIONS, BUILTIN_ROLE_SLUGS } from '../permissions/index.js';

const SLUG_RE = /^[a-z][a-z0-9_-]{1,30}$/;

export function slugifyParkRoleName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return slug || 'role';
}

export function parseParkRolePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission));
}

export function isReservedRoleSlug(slug: string): boolean {
  return BUILTIN_ROLE_SLUGS.includes(slug as typeof BUILTIN_ROLE_SLUGS[number]) || slug === 'super_admin';
}

export async function listParkRoles(tenantId: string) {
  return prisma.parkRole.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
  });
}

export async function findParkRoleBySlug(tenantId: string, slug: string) {
  return prisma.parkRole.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
  });
}

export async function uniqueParkRoleSlug(tenantId: string, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let n = 2;
  while (
    isReservedRoleSlug(slug) ||
    await prisma.parkRole.findUnique({ where: { tenantId_slug: { tenantId, slug } } })
  ) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
  return slug;
}

export async function createParkRole(params: {
  tenantId: string;
  name: string;
  slug?: string;
  description?: string;
  permissions: Permission[];
}) {
  const name = params.name.trim();
  if (!name) throw Object.assign(new Error('Role name is required'), { statusCode: 400 });

  const baseSlug = params.slug?.trim() || slugifyParkRoleName(name);
  if (!SLUG_RE.test(baseSlug)) {
    throw Object.assign(new Error('Slug must be 2–31 lowercase letters, numbers, hyphens, or underscores'), { statusCode: 400 });
  }

  const slug = await uniqueParkRoleSlug(params.tenantId, baseSlug);

  return prisma.parkRole.create({
    data: {
      tenantId: params.tenantId,
      slug,
      name,
      description: params.description?.trim() || null,
      permissions: params.permissions,
    },
  });
}

export async function updateParkRoleMeta(
  tenantId: string,
  slug: string,
  data: { name?: string; description?: string },
) {
  const role = await findParkRoleBySlug(tenantId, slug);
  if (!role) throw Object.assign(new Error('Custom role not found'), { statusCode: 404 });

  return prisma.parkRole.update({
    where: { id: role.id },
    data: {
      name: data.name?.trim() || role.name,
      description: data.description !== undefined ? (data.description.trim() || null) : role.description,
    },
  });
}

export async function updateParkRolePermissions(
  tenantId: string,
  slug: string,
  permissions: Permission[],
) {
  const role = await findParkRoleBySlug(tenantId, slug);
  if (!role) throw Object.assign(new Error('Custom role not found'), { statusCode: 404 });

  return prisma.parkRole.update({
    where: { id: role.id },
    data: { permissions },
  });
}

export async function deleteParkRole(tenantId: string, slug: string) {
  const role = await findParkRoleBySlug(tenantId, slug);
  if (!role) throw Object.assign(new Error('Custom role not found'), { statusCode: 404 });

  const assigned = await prisma.user.count({ where: { tenantId, role: slug } });
  if (assigned > 0) {
    throw Object.assign(
      new Error(`Cannot delete role — ${assigned} staff member(s) still assigned. Reassign them first.`),
      { statusCode: 400 },
    );
  }

  await prisma.parkRole.delete({ where: { id: role.id } });
}

export async function isAssignableParkRole(tenantId: string, role: string): Promise<boolean> {
  if (BUILTIN_ROLE_SLUGS.includes(role as typeof BUILTIN_ROLE_SLUGS[number])) return true;
  const custom = await findParkRoleBySlug(tenantId, role);
  return Boolean(custom);
}

export async function getParkRoleLabel(tenantId: string, role: string): Promise<string> {
  const labels: Record<string, string> = {
    park_owner: 'Park Owner',
    manager: 'Manager',
    cashier: 'Cashier',
    gate_staff: 'Gate Staff',
  };
  if (labels[role]) return labels[role];
  const custom = await findParkRoleBySlug(tenantId, role);
  return custom?.name ?? role;
}
