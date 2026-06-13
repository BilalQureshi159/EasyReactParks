import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SkeletonTable,
} from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface Booking {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerEmail: string;
  visitDate: string;
  ticketTypeName: string;
  quantity: number;
  total: number;
  status: string;
  createdAt: string;
}

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'default'> = {
  confirmed: 'success',
  pending: 'warning',
  cancelled: 'danger',
  completed: 'primary',
};

export function BookingsPage() {
  const tenantId = useTenantId();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'bookings'),
    queryFn: () => api.get<Booking[]>('/bookings'),
    enabled: Boolean(tenantId),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Online Bookings</h1>
        <p className="text-slate-500 mt-1">Manage customer reservations</p>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="p-6"><SkeletonTable /></div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">No bookings yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Visit Date</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-sm">{b.bookingNumber}</TableCell>
                  <TableCell>
                    <p className="font-medium">{b.customerName}</p>
                    <p className="text-xs text-slate-500">{b.customerEmail}</p>
                  </TableCell>
                  <TableCell>{formatDate(b.visitDate)}</TableCell>
                  <TableCell>{b.ticketTypeName}</TableCell>
                  <TableCell>{b.quantity}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(b.total)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[b.status] || 'default'}>{b.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
