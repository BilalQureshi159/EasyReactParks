import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '@/lib/api';
import type { ScanReport } from '@/types/reports';
import { formatDateTime, todayISO } from '@/lib/utils';
import { Card, CardHeader, CardTitle, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonCard } from '@/components/ui';
import { ParkDayControl } from '@/components/ParkDayControl';
import { KpiGrid, KpiCard } from '@/components/reports/ReportShell';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function ReportsAttendancePage() {
  const tenantId = useTenantId();
  const [scanDate, setScanDate] = useState(todayISO());
  const [scanResultFilter, setScanResultFilter] = useState<'all' | 'granted' | 'denied'>('all');
  const scanParam = scanResultFilter === 'all' ? '' : `&result=${scanResultFilter}`;

  const { data: scans, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-scans', scanDate, scanResultFilter),
    queryFn: () => api.get<ScanReport>(`/reports/scans?date=${scanDate}${scanParam}&limit=500`),
    enabled: Boolean(tenantId),
  });

  const { data: trend } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'reports-attendance', scanDate),
    queryFn: () => {
      const start = new Date(scanDate);
      start.setDate(start.getDate() - 14);
      const startStr = start.toISOString().split('T')[0];
      return api.get<{ date: string; entries: number; denied: number }[]>(
        `/reports/attendance?startDate=${startStr}&endDate=${scanDate}`
      );
    },
    enabled: Boolean(tenantId),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gate attendance</h1>
        <p className="text-slate-500 mt-1">Body count, scan log, and who checked guests in</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Input label="Scan date" type="date" value={scanDate} onChange={(e) => setScanDate(e.target.value)} className="w-44" />
          <ParkDayControl date={scanDate} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Filter</label>
            <select
              value={scanResultFilter}
              onChange={(e) => setScanResultFilter(e.target.value as 'all' | 'granted' | 'denied')}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="all">All scans</option>
              <option value="granted">Granted only</option>
              <option value="denied">Denied only</option>
            </select>
          </div>
        </div>
      </Card>

      {isLoading ? <SkeletonCard /> : (
        <>
          <KpiGrid>
            <KpiCard label="Body count" value={scans?.summary?.bodyCount ?? 0} hint="Entries granted" />
            <KpiCard label="Ticket entries" value={scans?.summary?.ticketEntries ?? 0} hint={`${scans?.summary?.uniqueTickets ?? 0} unique`} />
            <KpiCard label="Membership entries" value={scans?.summary?.membershipEntries ?? 0} />
            <KpiCard label="Denied" value={scans?.summary?.denied ?? 0} />
          </KpiGrid>

          <Card>
            <CardHeader><CardTitle>14-day trend</CardTitle></CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d + 'T12:00:00').toLocaleDateString('en', { day: 'numeric' })} stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="entries" fill="#10b981" name="Entries" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="denied" fill="#ef4444" name="Denied" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {(scans?.byStaff?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Checked in by (gate staff)</CardTitle></CardHeader>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Granted</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Denied</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(scans?.byStaff ?? []).map((s) => (
                    <tr key={s.staffId}>
                      <td className="px-4 py-3 font-medium">{s.staffName}</td>
                      <td className="px-4 py-3 text-emerald-700">{s.granted}</td>
                      <td className="px-4 py-3 text-red-600">{s.denied}</td>
                      <td className="px-4 py-3">{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card padding="none">
            <div className="p-4 border-b border-slate-100">
              <CardTitle>Scan log — {scanDate}</CardTitle>
            </div>
            {scans?.logs?.length === 0 ? (
              <p className="p-8 text-center text-slate-400 text-sm">No scans for this date</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Checked in by</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scans?.logs?.map((log: {
                    id: string; scannedAt: string; result: string; ticketId: string | null;
                    guestLabel: string; scannedByName: string; message: string;
                  }) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-slate-500">{formatDateTime(log.scannedAt)}</TableCell>
                      <TableCell><Badge variant={log.result === 'granted' ? 'success' : 'danger'}>{log.result}</Badge></TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-brand-700">{log.ticketId || '—'}</TableCell>
                      <TableCell>{log.guestLabel}</TableCell>
                      <TableCell>{log.scannedByName}</TableCell>
                      <TableCell className="text-sm text-slate-500 truncate max-w-[180px]">{log.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
