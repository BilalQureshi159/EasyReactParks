import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Receipt, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime, todayISO } from '@/lib/utils';
import {
  Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Input, SkeletonTable, Skeleton,
} from '@/components/ui';
import { ParkDayControl } from '@/components/ParkDayControl';
import { OrderDetailContent } from '@/components/orders/OrderDetailContent';
import type { OrderDetail, OrdersListResponse } from '@/types/orders';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

function OrderQuickView({ orderId, tenantId }: { orderId: string; tenantId: string | null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'order', orderId),
    queryFn: () => api.get<OrderDetail>(`/pos/orders/${orderId}`),
    enabled: Boolean(tenantId),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 bg-slate-50/80">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-slate-50/80 text-sm text-red-600">
        {error instanceof Error ? error.message : 'Failed to load order details'}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50/80 border-t border-slate-100">
      <OrderDetailContent data={data} compact showFullPageLink />
    </div>
  );
}

export function OrdersPage() {
  const tenantId = useTenantId();
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const isGlobalSearch = search.trim().length >= 2;

  const { data: dateData, isLoading: dateLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'orders', date),
    queryFn: () => api.get<OrdersListResponse>(`/pos/orders?date=${date}&limit=500`),
    enabled: Boolean(tenantId) && !isGlobalSearch,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'orders-search', search.trim()),
    queryFn: () => api.get<{ orders: OrdersListResponse['orders']; total: number; query: string }>(
      `/pos/orders/search?q=${encodeURIComponent(search.trim())}`
    ),
    enabled: Boolean(tenantId) && isGlobalSearch,
  });

  const data = isGlobalSearch ? {
    orders: searchData?.orders ?? [],
    summary: {
      totalOrders: searchData?.total ?? 0,
      totalRevenue: searchData?.orders.reduce((s, o) => s + o.total, 0) ?? 0,
      totalDiscount: searchData?.orders.reduce((s, o) => s + o.discount, 0) ?? 0,
    },
  } : dateData;

  const isLoading = isGlobalSearch ? searchLoading : dateLoading;
  const filtered = data?.orders ?? [];

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 mt-1">
            {isGlobalSearch
              ? 'Searching all dates by Order ID, Ticket ID, phone, name, or email'
              : 'All sales for the selected date'}
          </p>
        </div>
        <ParkDayControl date={date} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-slate-500">Orders</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{data?.summary.totalOrders ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Revenue</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{data ? formatCurrency(data.summary.totalRevenue) : '—'}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Discounts</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{data ? formatCurrency(data.summary.totalDiscount) : '—'}</p>
        </Card>
        <Card>
          <label className="text-sm text-slate-500">Select Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1"
          />
        </Card>
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search Order ID, Ticket ID, phone, name, email (min 2 chars)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus:ring-0"
          />
        </div>

        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {isGlobalSearch ? `No orders found for "${search.trim()}"` : `No orders for ${date}`}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Order #</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const isExpanded = expandedIds.has(order.id);
                return (
                  <Fragment key={order.id}>
                    <TableRow className={isExpanded ? 'bg-slate-50/50' : undefined}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(order.id)}
                          className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse order details' : 'Expand order details'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/orders/${order.id}`}
                          className="font-mono font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{order.id.slice(-8)}</TableCell>
                      <TableCell className="font-medium">{order.customerName || '—'}</TableCell>
                      <TableCell>
                        <p className="text-sm">{order.customerEmail || '—'}</p>
                        <p className="text-xs text-slate-500">{order.customerPhone || ''}</p>
                      </TableCell>
                      <TableCell>{order.ticketCount}</TableCell>
                      <TableCell className="capitalize">{order.paymentMethod || '—'}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(order.total)}</TableCell>
                      <TableCell className="text-sm text-slate-500">{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'completed' ? 'success' : 'default'}>{order.status}</Badge>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <OrderQuickView orderId={order.id} tenantId={tenantId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
