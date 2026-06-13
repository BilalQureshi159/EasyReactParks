import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BookingsReport } from '@/types/reports';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsBookingsPage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-bookings', range.startDate, range.endDate),
    queryFn: () => api.get<BookingsReport>(`/reports/bookings?${range.query}`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Bookings report"
      description="Online and manual bookings by visit date"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Total bookings" value={data?.summary?.total ?? 0} />
            <KpiCard label="Revenue" value={formatCurrency(data?.summary?.revenue ?? 0)} />
            <KpiCard label="Ticket quantity" value={data?.summary?.ticketQuantity ?? 0} />
          </KpiGrid>
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Visit date</TableHead>
                  <TableHead>Ticket type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.bookings?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">No bookings in period</TableCell></TableRow>
                ) : data?.bookings?.map((b: {
                  id: string; bookingNumber: string; customerName: string; customerEmail: string;
                  visitDate: string; ticketTypeName: string; quantity: number; total: number;
                  status: string; createdAt: string;
                }) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono font-semibold text-brand-700">{b.bookingNumber}</TableCell>
                    <TableCell>
                      <p>{b.customerName}</p>
                      <p className="text-xs text-slate-500">{b.customerEmail}</p>
                    </TableCell>
                    <TableCell>{formatDateTime(b.visitDate)}</TableCell>
                    <TableCell>{b.ticketTypeName}</TableCell>
                    <TableCell>{b.quantity}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(b.total)}</TableCell>
                    <TableCell><Badge>{b.status}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDateTime(b.createdAt)}</TableCell>
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
