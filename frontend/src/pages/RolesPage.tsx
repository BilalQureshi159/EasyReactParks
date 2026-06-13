import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { RolePermissionsEditor } from '@/components/roles/RolePermissionsEditor';
import { SkeletonCard } from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface RolesResponse {
  roles: {
    role: string;
    name: string;
    description?: string | null;
    isBuiltin: boolean;
    permissions: string[];
    isCustomized: boolean;
  }[];
  groups: Record<string, { key: string; label: string }[]>;
  catalog: Record<string, { label: string; group: string }>;
}

export function RolesPage() {
  const { can } = usePermissions();
  const readOnly = !can('roles.manage');
  const tenantId = useTenantId();
  const rolesQueryKey = tenantQueryKey(tenantId, 'roles');

  const { data, isLoading } = useQuery({
    queryKey: rolesQueryKey,
    queryFn: () => api.get<RolesResponse>('/roles'),
    enabled: Boolean(tenantId),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Shield className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Roles & Permissions</h1>
            <p className="text-slate-500 mt-0.5">
              {readOnly
                ? 'View what each role can access in your park'
                : 'Create custom roles, tune permissions, and assign roles to staff'}
            </p>
          </div>
        </div>
      </div>

      <RolePermissionsEditor
        roles={data.roles}
        groups={data.groups}
        updatePath={(role) => `/roles/${role}`}
        resetPath={(role) => `/roles/${role}/reset`}
        queryKey={rolesQueryKey}
        readOnly={readOnly}
        canManage={!readOnly}
      />
    </div>
  );
}
