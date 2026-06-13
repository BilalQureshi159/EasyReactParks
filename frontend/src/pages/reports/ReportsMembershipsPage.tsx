import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MembershipsReport } from '@/types/reports';
import { formatDateTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange, KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsMembershipsPage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-memberships', range.startDate, range.endDate),
    queryFn: () => api.get<MembershipsReport>(`/reports/memberships?${range.query}`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Memberships report"
      description="Active members, new sign-ups, and plan breakdown"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Active now" value={data?.summary?.active ?? 0} />
            <KpiCard label="New in period" value={data?.summary?.newInPeriod ?? 0} />
            <KpiCard label="Expiring in 30 days" value={data?.summary?.expiringIn30Days ?? 0} />
          </KpiGrid>
          {(data?.byPlan?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Active by plan</CardTitle></CardHeader>
              <div className="space-y-2">
                {(data?.byPlan ?? []).map((p) => (
                  <div key={p.planName} className="flex justify-between text-sm py-2 border-b border-slate-100">
                    <span>{p.planName}</span>
                    <span className="font-semibold">{p.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.memberships?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">No new memberships in period</TableCell></TableRow>
                ) : data?.memberships?.map((m: {
                  id: string; memberName: string; memberCode: string; planName: string;
                  startsAt: string; expiresAt: string; isActive: boolean;
                }) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="font-mono text-xs">{m.memberCode}</TableCell>
                    <TableCell>{m.planName}</TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDateTime(m.startsAt)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDateTime(m.expiresAt)}</TableCell>
                    <TableCell><Badge variant={m.isActive ? 'success' : 'default'}>{m.isActive ? 'active' : 'inactive'}</Badge></TableCell>
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
