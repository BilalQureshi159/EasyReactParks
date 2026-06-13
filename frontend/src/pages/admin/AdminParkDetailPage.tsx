import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LogIn, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatCurrency } from '@/lib/utils';
import { StaffManager } from '@/components/staff/StaffManager';
import { RolePermissionsEditor } from '@/components/roles/RolePermissionsEditor';
import { Button, Card, Badge, Input, SkeletonCard } from '@/components/ui';

interface ParkDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  currency: string;
  timezone: string;
  customDomain: string | null;
  isActive: boolean;
  stats: { revenue: number; orders: number };
}

export function AdminParkDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { impersonatePark } = useAuthStore();
  const [domain, setDomain] = useState('');

  const { data: park, isLoading } = useQuery({
    queryKey: ['admin', 'park', id],
    queryFn: () => api.get<ParkDetail>(`/admin/parks/${id}`),
    enabled: Boolean(id),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['admin', 'park', id, 'roles'],
    queryFn: () => api.get<{
      roles: {
        role: string;
        name: string;
        isBuiltin: boolean;
        permissions: string[];
        isCustomized: boolean;
      }[];
      groups: Record<string, { key: string; label: string }[]>;
    }>(`/admin/parks/${id}/roles`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (park) setDomain(park.customDomain || '');
  }, [park]);

  const saveDomainMutation = useMutation({
    mutationFn: (customDomain: string) => api.patch(`/admin/parks/${id}`, { customDomain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'park', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'parks'] });
      toast.success('Park settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !park) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const enterPark = async () => {
    try {
      await impersonatePark(park.id);
      toast.success(`Now viewing ${park.name}`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not enter park');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/admin/parks" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back to parks
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{park.name}</h1>
            <Badge variant={park.isActive ? 'success' : 'default'}>
              {park.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">{park.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.open(`/book/${park.slug}`, '_blank')}>
            <Globe className="h-4 w-4" />
            Booking page
          </Button>
          <Button onClick={enterPark} disabled={!park.isActive}>
            <LogIn className="h-4 w-4" />
            Login as admin
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <p className="text-sm text-slate-500">Total revenue</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(park.stats.revenue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Total orders</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{park.stats.orders}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Booking URL</p>
          <p className="text-sm font-medium text-brand-600 mt-2">/book/{park.slug}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Custom domain</h2>
        <p className="text-sm text-slate-500 mb-4">
          Point a subdomain to your app (e.g. splash.easyticketing.pk). DNS should route to this EasyTicketing instance.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            className="flex-1"
            placeholder="tickets.yourpark.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Button
            onClick={() => saveDomainMutation.mutate(domain)}
            loading={saveDomainMutation.isPending}
          >
            <Save className="h-4 w-4" />
            Save domain
          </Button>
        </div>
      </Card>

      <StaffManager
        title="Park staff"
        description="Add and manage staff for this park from the platform admin"
        listPath={`/admin/parks/${id}/staff`}
        createPath={`/admin/parks/${id}/staff`}
        updatePath={(userId) => `/admin/parks/${id}/staff/${userId}`}
        includeOwner
        assignableRoles={rolesData?.roles.map((r) => ({
          role: r.role,
          name: r.name ?? r.role,
          isBuiltin: r.isBuiltin ?? true,
        }))}
        queryKey={['admin', 'park', id, 'staff']}
      />

      {rolesData && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Roles & permissions</h2>
          <p className="text-slate-500 mb-4">Configure access for this park from the platform admin</p>
          <RolePermissionsEditor
            roles={rolesData.roles}
            groups={rolesData.groups}
            updatePath={(role) => `/admin/parks/${id}/roles/${role}`}
            resetPath={(role) => `/admin/parks/${id}/roles/${role}/reset`}
            queryKey={['admin', 'park', id, 'roles']}
          />
        </div>
      )}
    </div>
  );
}
