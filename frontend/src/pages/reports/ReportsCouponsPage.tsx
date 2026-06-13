import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CouponsReport } from '@/types/reports';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsCouponsPage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-coupons', range.startDate, range.endDate),
    queryFn: () => api.get<CouponsReport>(`/reports/coupons?${range.query}`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Coupons report"
      description="Coupon usage, discounts given, and all coupon codes"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Orders with coupon" value={data?.summary?.ordersWithCoupon ?? 0} />
            <KpiCard label="Discount total" value={formatCurrency(data?.summary?.totalDiscount ?? 0)} />
            <KpiCard label="Active coupons" value={data?.summary?.activeCoupons ?? 0} />
            <KpiCard label="Total codes" value={data?.summary?.totalCoupons ?? 0} />
          </KpiGrid>
          {(data?.usageInPeriod?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Usage in period</CardTitle></CardHeader>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b"><tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Code</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Orders</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Discount</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.usageInPeriod ?? []).map((u) => (
                    <tr key={u.code}>
                      <td className="px-4 py-2 font-mono font-semibold">{u.code}</td>
                      <td className="px-4 py-2">{u.orders}</td>
                      <td className="px-4 py-2">{formatCurrency(u.discount)}</td>
                      <td className="px-4 py-2">{formatCurrency(u.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Used (lifetime)</TableHead>
                  <TableHead>Max uses</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.allCoupons?.map((c: {
                  id: string; code: string; discountType: string; discountValue: number;
                  usedCount: number; maxUses?: number; isActive: boolean;
                }) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                    <TableCell>{c.discountType === 'percentage' ? `${c.discountValue}%` : formatCurrency(c.discountValue)}</TableCell>
                    <TableCell>{c.usedCount}</TableCell>
                    <TableCell>{c.maxUses ?? '∞'}</TableCell>
                    <TableCell><Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'active' : 'inactive'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </ReportShell>
  );
}
