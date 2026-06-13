import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, Badge, SkeletonCard } from '@/components/ui';
import { OrderDetailContent } from '@/components/orders/OrderDetailContent';
import type { OrderDetail } from '@/types/orders';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tenantId = useTenantId();

  const { data, isLoading, error } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'order', id),
    queryFn: () => api.get<OrderDetail>(`/pos/orders/${id}`),
    enabled: Boolean(id) && Boolean(tenantId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-5xl">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
        <Card>
          <p className="text-slate-600">
            {error instanceof Error ? error.message : 'Order not found'}
          </p>
        </Card>
      </div>
    );
  }

  const { order } = data;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{order.orderNumber}</h1>
              <p className="text-slate-500 mt-1">
                {order.orderDate} · {formatCurrency(order.total)}
              </p>
            </div>
          </div>
          <Badge variant={order.status === 'completed' ? 'success' : 'default'} className="self-start">
            {order.status}
          </Badge>
        </div>
      </div>

      <Card>
        <OrderDetailContent data={data} />
      </Card>
    </div>
  );
}
