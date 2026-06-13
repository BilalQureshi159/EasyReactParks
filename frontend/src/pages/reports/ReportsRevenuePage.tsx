import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import type { RevenueReport } from '@/types/reports';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsRevenuePage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-revenue', range.startDate, range.endDate),
    queryFn: () => api.get<RevenueReport>(`/reports/revenue?${range.query}`),
    enabled: Boolean(tenantId),
  });

  const totalRevenue = data?.daily?.reduce((s: number, d: { revenue: number }) => s + d.revenue, 0) ?? 0;
  const totalOrders = data?.daily?.reduce((s: number, d: { orders: number }) => s + d.orders, 0) ?? 0;

  return (
    <ReportShell
      title="Revenue report"
      description="Daily revenue, payment methods, and sales channels"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Total revenue" value={formatCurrency(totalRevenue)} />
            <KpiCard label="Orders" value={totalOrders} />
            <KpiCard label="Avg per day" value={formatCurrency(data?.daily?.length ? totalRevenue / data.daily.length : 0)} />
          </KpiGrid>
          <Card>
            <CardHeader><CardTitle>Daily revenue</CardTitle></CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })} stroke="#94a3b8" fontSize={12} />
                  <YAxis tickFormatter={(v) => `$${v}`} stroke="#94a3b8" fontSize={12} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="revenue" fill="#0c8ce9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>By payment method</CardTitle></CardHeader>
              <div className="space-y-2">
                {data?.byPayment?.map((p: { method: string; count: number; revenue: number }) => (
                  <div key={p.method} className="flex justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                    <span className="capitalize text-slate-700">{p.method || '—'}</span>
                    <span className="font-medium">{formatCurrency(p.revenue)} <span className="text-slate-400">({p.count})</span></span>
                  </div>
                )) ?? <p className="text-slate-400 text-sm">No data</p>}
              </div>
            </Card>
            <Card>
              <CardHeader><CardTitle>By source</CardTitle></CardHeader>
              <div className="space-y-2">
                {data?.bySource?.map((s: { source: string; count: number; revenue: number }) => (
                  <div key={s.source} className="flex justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                    <span className="capitalize text-slate-700">{s.source}</span>
                    <span className="font-medium">{formatCurrency(s.revenue)} <span className="text-slate-400">({s.count})</span></span>
                  </div>
                )) ?? <p className="text-slate-400 text-sm">No data</p>}
              </div>
            </Card>
          </div>
        </>
      )}
    </ReportShell>
  );
}
