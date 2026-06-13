import type { ParkRole } from '@prisma/client';
import type { UserRole } from '../types/index.js';
import type { ITenant } from '../models/index.js';

function parseParkRolePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission));
}

export const PERMISSION_CATALOG = {
  'dashboard.view': { label: 'View dashboard', group: 'Overview' },
  'pos.use': { label: 'Use POS', group: 'Sales' },
  'orders.view': { label: 'View orders', group: 'Sales' },
  'scanner.use': { label: 'Use gate scanner', group: 'Operations' },
  'bookings.view': { label: 'View bookings', group: 'Sales' },
  'bookings.manage': { label: 'Manage bookings', group: 'Sales' },
  'memberships.view': { label: 'View memberships', group: 'Sales' },
  'memberships.manage': { label: 'Sell & manage memberships', group: 'Sales' },
  'tickets.view': { label: 'View ticket types', group: 'Catalog' },
  'tickets.manage': { label: 'Manage ticket types', group: 'Catalog' },
  'coupons.view': { label: 'View coupons', group: 'Catalog' },
  'coupons.manage': { label: 'Manage coupons', group: 'Catalog' },
  'staff.view': { label: 'View staff', group: 'Team' },
  'staff.manage': { label: 'Add & manage staff', group: 'Team' },
  'roles.view': { label: 'View roles & permissions', group: 'Team' },
  'roles.manage': { label: 'Edit role permissions', group: 'Team' },
  'reports.view': { label: 'View reports', group: 'Insights' },
  'audit.view': { label: 'View audit logs', group: 'Insights' },
  'settings.view': { label: 'View settings', group: 'Settings' },
  'settings.manage': { label: 'Edit park & SMTP settings', group: 'Settings' },
  'operations.manage': { label: 'Open & close park', group: 'Operations' },
  'support.view': { label: 'View support tickets', group: 'Support' },
  'support.create': { label: 'Submit support tickets', group: 'Support' },
} as const;

export type Permission = keyof typeof PERMISSION_CATALOG;

export const ALL_PERMISSIONS = Object.keys(PERMISSION_CATALOG) as Permission[];

export const BUILTIN_ROLE_LABELS: Record<string, string> = {
  park_owner: 'Park Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  gate_staff: 'Gate Staff',
};

export const BUILTIN_ROLE_SLUGS = ['park_owner', 'manager', 'cashier', 'gate_staff'] as const;
export type BuiltinParkRole = typeof BUILTIN_ROLE_SLUGS[number];

export const PARK_ROLES: UserRole[] = ['park_owner', 'manager', 'cashier', 'gate_staff'];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  park_owner: [...ALL_PERMISSIONS],
  manager: [
    'dashboard.view', 'pos.use', 'orders.view', 'scanner.use',
    'bookings.view', 'bookings.manage', 'memberships.view', 'memberships.manage',
    'tickets.view', 'tickets.manage', 'coupons.view', 'coupons.manage',
    'staff.view', 'staff.manage', 'roles.view',
    'reports.view', 'audit.view', 'settings.view', 'settings.manage', 'operations.manage',
    'support.view', 'support.create',
  ],
  cashier: [
    'pos.use', 'orders.view', 'bookings.view', 'memberships.view', 'memberships.manage',
  ],
  gate_staff: ['scanner.use'],
};

const OWNER_LOCKED: Permission[] = ['roles.manage', 'roles.view', 'staff.manage'];

export function isBuiltinParkRole(role: string): role is BuiltinParkRole {
  return BUILTIN_ROLE_SLUGS.includes(role as BuiltinParkRole);
}

export function filterValidPermissions(permissions: string[]): Permission[] {
  return permissions.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission));
}

export function getTenantRolePermissions(tenant: ITenant | null, role: UserRole): Permission[] {
  const overrides = tenant?.rolePermissions?.[role];
  const base = overrides?.length ? [...overrides] as Permission[] : [...DEFAULT_ROLE_PERMISSIONS[role]];

  if (role === 'park_owner') {
    for (const perm of OWNER_LOCKED) {
      if (!base.includes(perm)) base.push(perm);
    }
  }

  return base.filter((p) => ALL_PERMISSIONS.includes(p));
}

export function resolveRolePermissions(
  tenant: ITenant | null,
  role: string,
  customRoles: ParkRole[] = [],
): Permission[] {
  if (role === 'super_admin') return [...ALL_PERMISSIONS];

  const custom = customRoles.find((r) => r.slug === role);
  if (custom) return parseParkRolePermissions(custom.permissions);

  if (isBuiltinParkRole(role)) {
    return getTenantRolePermissions(tenant, role);
  }

  return [];
}

export function roleHasPermission(
  tenant: ITenant | null,
  role: string,
  permission: Permission,
  customRoles: ParkRole[] = [],
): boolean {
  if (role === 'super_admin') return true;
  return resolveRolePermissions(tenant, role, customRoles).includes(permission);
}

export interface RoleWithPermissions {
  role: string;
  name: string;
  description?: string | null;
  isBuiltin: boolean;
  permissions: Permission[];
  defaults?: Permission[];
  isCustomized: boolean;
}

export function getRolesWithPermissions(tenant: ITenant | null, customRoles: ParkRole[] = []): RoleWithPermissions[] {
  const builtin = PARK_ROLES.map((role) => ({
    role,
    name: BUILTIN_ROLE_LABELS[role] ?? role,
    description: null,
    isBuiltin: true,
    permissions: getTenantRolePermissions(tenant, role),
    defaults: DEFAULT_ROLE_PERMISSIONS[role],
    isCustomized: Boolean(tenant?.rolePermissions?.[role]?.length),
  }));

  const custom = customRoles.map((cr) => ({
    role: cr.slug,
    name: cr.name,
    description: cr.description,
    isBuiltin: false,
    permissions: parseParkRolePermissions(cr.permissions),
    isCustomized: true,
  }));

  return [...builtin, ...custom];
}

export function validateRolePermissions(role: string, permissions: string[]): Permission[] {
  if (!isBuiltinParkRole(role)) {
    throw Object.assign(new Error('Invalid built-in role'), { statusCode: 400 });
  }

  const valid = filterValidPermissions(permissions);

  if (role === 'park_owner') {
    for (const perm of OWNER_LOCKED) {
      if (!valid.includes(perm)) valid.push(perm);
    }
  }

  return valid;
}

export function validateCustomRolePermissions(permissions: string[]): Permission[] {
  return filterValidPermissions(permissions);
}

export function buildAssignableRoles(customRoles: ParkRole[], includeOwner = false) {
  const builtinSlugs = includeOwner
    ? [...BUILTIN_ROLE_SLUGS]
    : BUILTIN_ROLE_SLUGS.filter((r) => r !== 'park_owner');

  const builtin = builtinSlugs.map((role) => ({
    role,
    name: BUILTIN_ROLE_LABELS[role] ?? role,
    isBuiltin: true,
  }));

  const custom = customRoles.map((cr) => ({
    role: cr.slug,
    name: cr.name,
    isBuiltin: false,
  }));

  return [...builtin, ...custom];
}
