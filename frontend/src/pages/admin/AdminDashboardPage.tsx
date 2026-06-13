import { useQuery } from '@tanstack/react-query';
import { Building2, DollarSign, Receipt, Users, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, Badge, SkeletonCard } from '@/components/ui';

interface PlatformDashboard {
  kpis: {
    totalParks: number;
    activeParks: number;
    totalStaff: number;
    totalRevenue: number;
    totalOrders: number;
    todayRevenue: number;
    todayOrders: number;
  };
  parks: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    customDomain: string | null;
    revenue: number;
    orders: number;
    todayRevenue: number;
    todayOrders: number;
  }[];
}

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<PlatformDashboard>('/admin/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
          <p className="text-slate-500 mt-1">Revenue and activity across all parks</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
        <p className="text-slate-500 mt-1">Revenue and activity across all parks on one domain</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KPICard
          icon={DollarSign}
          label="Total revenue"
          value={formatCurrency(kpis?.totalRevenue ?? 0)}
          sub={`Today: ${formatCurrency(kpis?.todayRevenue ?? 0)}`}
          color="text-emerald-600 bg-emerald-50"
        />
        <KPICard
          icon={Receipt}
          label="Total orders"
          value={String(kpis?.totalOrders ?? 0)}
          sub={`Today: ${kpis?.todayOrders ?? 0}`}
          color="text-brand-600 bg-brand-50"
        />
        <KPICard
          icon={Building2}
          label="Parks"
          value={String(kpis?.totalParks ?? 0)}
          sub={`${kpis?.activeParks ?? 0} active`}
          color="text-violet-600 bg-violet-50"
        />
        <KPICard
          icon={Users}
          label="Total staff"
          value={String(kpis?.totalStaff ?? 0)}
          sub="Across all parks"
          color="text-amber-600 bg-amber-50"
        />
      </div>

      <Card padding="none">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Revenue by park</h2>
            <p className="text-sm text-slate-500">All-time completed order revenue</p>
          </div>
          <Link to="/admin/parks" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Manage parks →
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.parks ?? []).map((park) => (
            <Link
              key={park.id}
              to={`/admin/parks/${park.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{park.name}</p>
                  <Badge variant={park.isActive ? 'success' : 'default'}>
                    {park.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  /book/{park.slug}
                  {park.customDomain && ` · ${park.customDomain}`}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="font-semibold text-slate-900">{formatCurrency(park.revenue)}</p>
                <p className="text-xs text-slate-500 flex items-center justify-end gap-1 mt-0.5">
                  <TrendingUp className="h-3 w-3" />
                  Today {formatCurrency(park.todayRevenue)} · {park.orders} orders
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <Card>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </Card>
  );
}
