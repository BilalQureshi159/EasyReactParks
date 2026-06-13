import { useState } from 'react';
import { todayISO } from '@/lib/utils';
import { Card, Input } from '@/components/ui';

export function useReportRange(defaultDays = 0) {
  const end = todayISO();
  const start = new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultDays > 0 ? start : end);
  const [endDate, setEndDate] = useState(end);
  const query = `startDate=${startDate}&endDate=${endDate}`;
  return { startDate, endDate, setStartDate, setEndDate, query };
}

export function ReportShell({
  title,
  description,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  children,
}: {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-slate-500 mt-1">{description}</p>}
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Start date" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
          <Input label="End date" type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </div>
      </Card>

      {children}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{children}</div>;
}

export function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </Card>
  );
}
