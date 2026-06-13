import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SalesReport } from '@/types/reports';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsSalesPage() {
  const range = useReportRange(0);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-sales-range', range.startDate, range.endDate),
    queryFn: () => api.get<SalesReport>(`/reports/sales?${range.query}`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Sales & orders"
      description="Every completed order in the selected period"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Orders" value={data?.summary?.totalOrders ?? 0} />
            <KpiCard label="Revenue" value={formatCurrency(data?.summary?.totalRevenue ?? 0)} />
            <KpiCard label="Discounts" value={formatCurrency(data?.summary?.totalDiscount ?? 0)} />
            <KpiCard label="Avg order" value={formatCurrency(data?.summary?.avgOrderValue ?? 0)} />
          </KpiGrid>
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.orders?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">No orders in this period</TableCell></TableRow>
                ) : data?.orders?.map((o: {
                  id: string; orderNumber: string; customerName?: string; customerEmail?: string;
                  customerPhone?: string; ticketCount: number; paymentMethod?: string;
                  createdByName?: string; total: number; createdAt: string;
                }) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-semibold text-brand-700">{o.orderNumber}</TableCell>
                    <TableCell>{o.customerName || '—'}</TableCell>
                    <TableCell>
                      <p className="text-sm">{o.customerEmail || '—'}</p>
                      <p className="text-xs text-slate-500">{o.customerPhone || ''}</p>
                    </TableCell>
                    <TableCell>{o.ticketCount}</TableCell>
                    <TableCell><Badge variant="primary">{o.paymentMethod}</Badge></TableCell>
                    <TableCell className="text-sm">{o.createdByName || '—'}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDateTime(o.createdAt)}</TableCell>
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
