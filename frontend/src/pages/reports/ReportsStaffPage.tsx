import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StaffReport } from '@/types/reports';
import { formatCurrency } from '@/lib/utils';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ReportShell, useReportRange } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsStaffPage() {
  const range = useReportRange(30);
  const tenantId = useTenantId();
  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-staff', range.startDate, range.endDate),
    queryFn: () => api.get<StaffReport>(`/reports/staff?${range.query}`),
    enabled: Boolean(tenantId),
  });

  return (
    <ReportShell
      title="Staff & POS activity"
      description="Sales and gate scans per team member"
      startDate={range.startDate}
      endDate={range.endDate}
      onStartDateChange={range.setStartDate}
      onEndDateChange={range.setEndDate}
    >
      {isLoading ? <SkeletonCard /> : (
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>POS orders</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Discounts</TableHead>
                <TableHead>Scans granted</TableHead>
                <TableHead>Scans denied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.staff?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">No staff activity in period</TableCell></TableRow>
              ) : data?.staff?.map((s: {
                staffId: string; staffName: string; role: string; orders: number;
                revenue: number; discount: number; scansGranted: number; scansDenied: number;
              }) => (
                <TableRow key={s.staffId}>
                  <TableCell className="font-medium">{s.staffName}</TableCell>
                  <TableCell className="text-sm capitalize text-slate-500">{s.role?.replace('_', ' ')}</TableCell>
                  <TableCell>{s.orders}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(s.revenue)}</TableCell>
                  <TableCell>{formatCurrency(s.discount)}</TableCell>
                  <TableCell className="text-emerald-700">{s.scansGranted}</TableCell>
                  <TableCell className="text-red-600">{s.scansDenied}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </ReportShell>
  );
}
