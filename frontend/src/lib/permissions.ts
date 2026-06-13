import { useAuthStore } from '@/stores/auth';

export type Permission =
  | 'dashboard.view'
  | 'pos.use'
  | 'orders.view'
  | 'scanner.use'
  | 'bookings.view'
  | 'bookings.manage'
  | 'memberships.view'
  | 'memberships.manage'
  | 'tickets.view'
  | 'tickets.manage'
  | 'coupons.view'
  | 'coupons.manage'
  | 'staff.view'
  | 'staff.manage'
  | 'roles.view'
  | 'roles.manage'
  | 'reports.view'
  | 'audit.view'
  | 'settings.view'
  | 'settings.manage'
  | 'operations.manage'
  | 'support.view'
  | 'support.create';

export const NAV_PERMISSIONS: Record<string, Permission> = {
  '/dashboard': 'dashboard.view',
  '/pos': 'pos.use',
  '/orders': 'orders.view',
  '/scanner': 'scanner.use',
  '/staff': 'staff.view',
  '/roles': 'roles.view',
  '/tickets': 'tickets.view',
  '/bookings': 'bookings.view',
  '/memberships': 'memberships.view',
  '/coupons': 'coupons.view',
  '/reports': 'reports.view',
  '/settings': 'settings.view',
  '/support': 'support.view',
};

export function usePermissions() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);

  const can = (permission: Permission) => permissions.includes(permission);
  const canAny = (...perms: Permission[]) => perms.some((p) => permissions.includes(p));

  return { permissions, can, canAny };
}
