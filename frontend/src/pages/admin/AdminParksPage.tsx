import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, LogIn, Power, PowerOff, Users, Receipt, Globe, Waves, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatCurrency } from '@/lib/utils';
import { CreateParkWizard, type CreateParkForm } from '@/components/admin/CreateParkWizard';
import { Button, Card, Badge, SkeletonCard } from '@/components/ui';

interface Park {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  currency: string;
  timezone: string;
  customDomain: string | null;
  isActive: boolean;
  userCount: number;
  orderCount: number;
  revenue: number;
  createdAt: string;
}

const parkTypeLabels: Record<string, string> = {
  waterpark: 'Waterpark',
  amusement_park: 'Amusement Park',
};

export function AdminParksPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { impersonatePark } = useAuthStore();

  const { data: parks = [], isLoading } = useQuery({
    queryKey: ['admin', 'parks'],
    queryFn: () => api.get<Park[]>('/admin/parks'),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateParkForm) => api.post('/admin/parks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'parks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      setWizardOpen(false);
      toast.success('Park created with default catalog');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/parks/${id}`, { isActive }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'parks'] });
      toast.success(vars.isActive ? 'Park activated' : 'Park deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const enterPark = async (park: Park) => {
    if (!park.isActive) {
      toast.error('Activate this park before entering');
      return;
    }
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
          <h1 className="text-2xl font-bold text-slate-900">Park Marketplace</h1>
          <p className="text-slate-500 mt-1">
            Create parks, manage staff, set custom domains, and login as park admin.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          Onboard park
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : parks.length === 0 ? (
          <Card className="col-span-full text-center py-16">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">No parks yet</h3>
            <p className="text-slate-500 mt-1 mb-6">Run the onboarding wizard to create your first park.</p>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              Onboard park
            </Button>
          </Card>
        ) : (
          parks.map((park) => (
            <Card key={park.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
                  <Waves className="h-5 w-5 text-brand-700" />
                </div>
                <Badge variant={park.isActive ? 'success' : 'default'}>
                  {park.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <Link to={`/admin/parks/${park.id}`} className="hover:text-brand-700">
                <h3 className="text-lg font-semibold text-slate-900">{park.name}</h3>
              </Link>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2 flex-1">
                {park.description || 'No description'}
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="default">{parkTypeLabels[park.type] || park.type}</Badge>
                <Badge variant="default">{park.slug}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="h-4 w-4 text-slate-400" />
                  {park.userCount} staff
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Receipt className="h-4 w-4 text-slate-400" />
                  {formatCurrency(park.revenue)}
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-3">
                Created {formatDate(park.createdAt)}
              </p>

              <div className="flex flex-wrap gap-2 mt-5">
                <Button className="flex-1" onClick={() => enterPark(park)} disabled={!park.isActive}>
                  <LogIn className="h-4 w-4" />
                  Login as admin
                </Button>
                <Link to={`/admin/parks/${park.id}`}>
                  <Button variant="secondary" title="Manage park & staff">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => window.open(`/book/${park.slug}`, '_blank')}
                  title="Public booking page"
                >
                  <Globe className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => toggleMutation.mutate({ id: park.id, isActive: !park.isActive })}
                  title={park.isActive ? 'Deactivate park' : 'Activate park'}
                >
                  {park.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <CreateParkWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSubmit={(form) => createMutation.mutate(form)}
        loading={createMutation.isPending}
      />
    </div>
  );
}
