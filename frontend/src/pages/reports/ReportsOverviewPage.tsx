import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OverviewReport } from '@/types/reports';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsOverviewPage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-overview', range.startDate, range.endDate),
    queryFn: () => api.get<OverviewReport>(`/reports/overview?${range.query}`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Reports overview"
      description="Executive summary across revenue, attendance, tickets, bookings, and more"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Revenue" value={formatCurrency(data?.revenue?.total ?? 0)} hint={`${data?.revenue?.orders ?? 0} orders`} />
            <KpiCard label="Body count" value={data?.attendance?.bodyCount ?? 0} hint="Gate entries granted" />
            <KpiCard label="Tickets issued" value={data?.tickets?.issued ?? 0} hint={`${data?.tickets?.used ?? 0} used`} />
            <KpiCard label="Bookings" value={data?.bookings?.total ?? 0} hint={formatCurrency(data?.bookings?.revenue ?? 0)} />
          </KpiGrid>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Memberships</CardTitle></CardHeader>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-500">Active:</span> <strong>{data?.memberships?.active ?? 0}</strong></p>
                <p><span className="text-slate-500">New in period:</span> <strong>{data?.memberships?.newInPeriod ?? 0}</strong></p>
              </div>
            </Card>
            <Card>
              <CardHeader><CardTitle>Coupons</CardTitle></CardHeader>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-500">Orders with coupon:</span> <strong>{data?.coupons?.ordersWithCoupon ?? 0}</strong></p>
                <p><span className="text-slate-500">Discount given:</span> <strong>{formatCurrency(data?.coupons?.discountTotal ?? 0)}</strong></p>
              </div>
            </Card>
          </div>
          {(data?.topTicketTypes?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Top ticket types</CardTitle></CardHeader>
              <div className="space-y-2">
                {(data?.topTicketTypes ?? []).map((t) => (
                  <div key={t.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </div>
                    <span className="font-semibold">{t.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </ReportShell>
  );
}
