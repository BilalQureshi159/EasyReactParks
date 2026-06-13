import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { Button, Badge } from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface ParkDayStatus {
  date: string;
  isOpen: boolean;
  note?: string;
}

interface ParkDayControlProps {
  date: string;
  onStatusChange?: (isOpen: boolean) => void;
}

export function ParkDayControl({ date, onStatusChange }: ParkDayControlProps) {
  const { user } = useAuthStore();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'park_owner' || user?.role === 'manager';

  const { data: status, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'park-day', date),
    queryFn: () => api.get<ParkDayStatus>(`/operations/day?date=${date}`),
    enabled: Boolean(tenantId),
  });

  const toggle = useMutation({
    mutationFn: (isOpen: boolean) =>
      api.put<ParkDayStatus>('/operations/day', { date, isOpen }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'park-day', date) });
      toast.success(data.isOpen ? 'Park opened for this date' : 'Park closed for this date');
      onStatusChange?.(data.isOpen);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !status) {
    return <div className="h-10 w-32 animate-pulse bg-slate-100 rounded-xl" />;
  }

  return (
    <div className="flex items-center gap-3">
      <Badge variant={status.isOpen ? 'success' : 'danger'} className="px-3 py-1">
        {status.isOpen ? 'Park Open' : 'Park Closed'}
      </Badge>
      {canManage && (
        <Button
          size="sm"
          variant={status.isOpen ? 'danger' : 'success'}
          loading={toggle.isPending}
          onClick={() => toggle.mutate(!status.isOpen)}
        >
          {status.isOpen ? (
            <><Lock className="h-4 w-4" /> Close Park</>
          ) : (
            <><Unlock className="h-4 w-4" /> Open Park</>
          )}
        </Button>
      )}
      {!status.isOpen && (
        <p className={cn('text-sm text-red-600')}>No orders allowed for {date}</p>
      )}
    </div>
  );
}
