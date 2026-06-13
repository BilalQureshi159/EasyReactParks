import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditReport } from '@/types/reports';
import { Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsAuditPage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-audit', range.startDate, range.endDate),
    queryFn: () => api.get<AuditReport>(`/reports/audit-activity?${range.query}&limit=500`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Audit activity"
      description="System actions — orders, scans, settings changes, and staff actions"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Events logged" value={data?.summary?.total ?? 0} />
            {data?.summary?.byAction?.slice(0, 3).map((a: { action: string; count: number }) => (
              <KpiCard key={a.action} label={a.action} value={a.count} />
            ))}
          </KpiGrid>
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.logs?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-slate-400 py-8">No audit events in period</TableCell></TableRow>
                ) : data?.logs?.map((log: {
                  id: string; action: string; userName: string | null; entityType: string;
                  details: Record<string, unknown>; createdAt: string;
                }) => (
                  <TableRow key={log.id}>
                    <TableCell><Badge variant="primary">{log.action}</Badge></TableCell>
                    <TableCell className="font-medium">{log.userName || 'System'}</TableCell>
                    <TableCell className="text-slate-500">{log.entityType || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{new Date(log.createdAt).toLocaleString()}</TableCell>
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
