import { useQuery } from '@tanstack/react-query';
import { DollarSign, Ticket, Users, TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Card, CardHeader, CardTitle, SkeletonCard } from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface DashboardStats {
  kpis: {
    revenue: { today: number; yesterday: number; change: number };
    orders: { today: number; yesterday: number };
    visitors: { today: number; scansGranted: number; scansDenied: number };
  };
  revenueChart: { date: string; revenue: number }[];
  topTickets: { name: string; count: number; color: string }[];
}

export function DashboardPage() {
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'dashboard-stats'),
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
    enabled: Boolean(tenantId),
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of today's performance</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of today's performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="Revenue"
          value={formatCurrency(kpis?.revenue.today || 0)}
          change={kpis?.revenue.change || 0}
          subtitle={`Yesterday: ${formatCurrency(kpis?.revenue.yesterday || 0)}`}
          icon={DollarSign}
          iconColor="bg-emerald-50 text-emerald-600"
        />
        <KPICard
          title="Orders"
          value={String(kpis?.orders.today || 0)}
          change={
            kpis?.orders.yesterday
              ? ((kpis.orders.today - kpis.orders.yesterday) / kpis.orders.yesterday) * 100
              : 0
          }
          subtitle={`Yesterday: ${kpis?.orders.yesterday || 0}`}
          icon={Ticket}
          iconColor="bg-brand-50 text-brand-600"
        />
        <KPICard
          title="Visitors"
          value={String(kpis?.visitors.today || 0)}
          subtitle={`${kpis?.visitors.scansGranted || 0} entries · ${kpis?.visitors.scansDenied || 0} denied`}
          icon={Users}
          iconColor="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue — Last 7 Days</CardTitle>
          </CardHeader>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.revenueChart || []}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0c8ce9" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#0c8ce9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en', { weekday: 'short' })}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0c8ce9"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Tickets</CardTitle>
          </CardHeader>
          <div className="h-72 flex items-center justify-center">
            {data?.topTickets && data.topTickets.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.topTickets}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {data.topTickets.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No ticket data yet</p>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {data?.topTickets?.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-slate-600">{t.name}</span>
                </div>
                <span className="font-medium text-slate-900">{t.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPICard({
  title, value, change, subtitle, icon: Icon, iconColor,
}: {
  title: string;
  value: string;
  change?: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <Card hover>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
          <div className="flex items-center gap-2">
            {change !== undefined && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatPercent(change)}
              </span>
            )}
            <span className="text-xs text-slate-400">{subtitle}</span>
          </div>
        </div>
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
