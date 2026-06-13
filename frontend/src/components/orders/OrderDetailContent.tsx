import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { OrderDetail } from '@/types/orders';

function statusVariant(status: string) {
  if (status === 'completed' || status === 'valid') return 'success' as const;
  if (status === 'used') return 'primary' as const;
  if (status === 'cancelled' || status === 'refunded' || status === 'expired') return 'danger' as const;
  return 'default' as const;
}

export function OrderDetailContent({
  data,
  compact = false,
  showFullPageLink = false,
}: {
  data: OrderDetail;
  compact?: boolean;
  showFullPageLink?: boolean;
}) {
  const { order, lineItems, tickets } = data;

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {showFullPageLink && (
        <div className="flex justify-end">
          <Link
            to={`/orders/${order.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Open full order page
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Customer</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{order.customerName || '—'}</p>
          <p className="text-sm text-slate-600">{order.customerEmail || '—'}</p>
          <p className="text-sm text-slate-500">{order.customerPhone || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Order info</p>
          <p className="text-sm text-slate-900 mt-1">Date: {order.orderDate}</p>
          <p className="text-sm text-slate-600 capitalize">Payment: {order.paymentMethod || '—'}</p>
          <p className="text-sm text-slate-600 capitalize">Source: {order.source}</p>
          {order.couponCode && (
            <p className="text-sm text-slate-600">Coupon: {order.couponCode}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Staff</p>
          <p className="text-sm text-slate-900 mt-1">{order.createdByName || '—'}</p>
          <p className="text-sm text-slate-500">{formatDateTime(order.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Totals</p>
          <div className="mt-1 space-y-0.5 text-sm">
            <p className="text-slate-600">Subtotal: {formatCurrency(order.subtotal)}</p>
            <p className="text-slate-600">Discount: {formatCurrency(order.discount)}</p>
            <p className="text-slate-600">Tax: {formatCurrency(order.tax)}</p>
            <p className="font-semibold text-slate-900">Total: {formatCurrency(order.total)}</p>
          </div>
        </div>
      </div>

      {lineItems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Line items</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Ticket type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Price</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineItems.map((item) => (
                  <tr key={item.ticketTypeId}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-slate-900">{item.ticketTypeName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                      {formatCurrency(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Tickets ({tickets.length})
        </p>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Ticket ID</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Valid until</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Scanned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-brand-700">
                    {ticket.ticketCode}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: ticket.ticketTypeColor }}
                      />
                      {ticket.ticketTypeName}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">
                    {ticket.validUntil ? formatDateTime(ticket.validUntil) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">
                    {ticket.scannedAt ? formatDateTime(ticket.scannedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!compact && (
        <div className="flex items-center gap-2 pt-2">
          <span className="text-sm text-slate-500">Order status:</span>
          <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
          <span className="text-xs text-slate-400 font-mono ml-2">ID: {order.id}</span>
        </div>
      )}
    </div>
  );
}
