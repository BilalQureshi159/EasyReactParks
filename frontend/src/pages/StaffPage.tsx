import { StaffManager } from '@/components/staff/StaffManager';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function StaffPage() {
  const tenantId = useTenantId();
  return (
    <div className="animate-fade-in">
      <StaffManager
        listPath="/staff"
        updatePath={(id) => `/staff/${id}`}
        queryKey={tenantQueryKey(tenantId, 'staff')}
      />
    </div>
  );
}
