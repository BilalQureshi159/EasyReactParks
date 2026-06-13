import { useAuthStore } from '@/stores/auth';

/** Active park tenant id (null for platform super-admin outside impersonation). */
export function useTenantId() {
  return useAuthStore((s) => s.user?.tenant?.id ?? null);
}

/** React Query key scoped to the current park so caches do not leak across tenants. */
export function tenantQueryKey(
  tenantId: string | null | undefined,
  ...parts: (string | number | boolean | null | undefined)[]
): readonly [string, string, ...(string | number | boolean)[]] {
  const scopedParts = parts.filter((p) => p !== undefined && p !== null) as (string | number | boolean)[];
  return ['tenant', tenantId ?? 'none', ...scopedParts];
}
