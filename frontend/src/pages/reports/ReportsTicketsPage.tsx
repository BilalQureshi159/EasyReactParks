import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TicketsReport } from '@/types/reports';
import { formatDateTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsTicketsPage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-tickets', range.startDate, range.endDate),
    queryFn: () => api.get<TicketsReport>(`/reports/tickets?${range.query}`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Tickets issued"
      description="Every ticket created in the period — status, type, and scan time"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Total issued" value={data?.summary?.total ?? 0} />
            {data?.summary?.byStatus?.map((s: { status: string; count: number }) => (
              <KpiCard key={s.status} label={s.status} value={s.count} />
            ))}
          </KpiGrid>
          {(data?.byType?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>By ticket type</CardTitle></CardHeader>
              <div className="space-y-2">
                {(data?.byType ?? []).map((t) => (
                  <div key={t.name} className="flex justify-between text-sm py-2 border-b border-slate-100 last:border-0">
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
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scanned</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.tickets?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">No tickets in period</TableCell></TableRow>
                ) : data?.tickets?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs font-semibold text-brand-700">{t.ticketId}</TableCell>
                    <TableCell>{t.ticketTypeName}</TableCell>
                    <TableCell className="font-mono text-xs">{t.orderNumber}</TableCell>
                    <TableCell>{t.customerName}</TableCell>
                    <TableCell><Badge variant={t.status === 'valid' ? 'success' : t.status === 'used' ? 'primary' : 'default'}>{t.status}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-500">{t.scannedAt ? formatDateTime(t.scannedAt) : '—'}</TableCell>
                    <TableCell className="text-sm text-slate-500">{t.createdAt ? formatDateTime(t.createdAt) : '—'}</TableCell>
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
