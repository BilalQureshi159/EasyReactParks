import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Trash2, CreditCard, Banknote, CheckCircle2, Printer, AlertTriangle, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, cn, todayISO } from '@/lib/utils';
import { Button, Card, Input, Modal, Badge, SkeletonCard } from '@/components/ui';
import { ParkDayControl } from '@/components/ParkDayControl';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface TicketType {
  id: string;
  name: string;
  description: string;
  price: number;
  color: string;
  category: string;
}

interface CartItem {
  ticketType: TicketType;
  quantity: number;
}

interface OrderResult {
  order: {
    id: string;
    orderNumber: string;
    total: number;
    paymentMethod: string;
  };
  email?: {
    sent: boolean;
    previewUrl?: string;
    error?: string;
  };
  tickets: {
    id: string;
    ticketCode: string;
    qrImage: string;
    ticketTypeName: string;
  }[];
}

interface ParkDayStatus {
  isOpen: boolean;
}

interface AppliedCoupon {
  valid: true;
  code: string;
  discount: number;
  description?: string;
  discountType: string;
  discountValue: number;
}

export function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDate, setOrderDate] = useState(todayISO());
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');
  const [completedOrder, setCompletedOrder] = useState<OrderResult | null>(null);
  const [parkOpen, setParkOpen] = useState(true);
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  const { data: ticketTypes = [], isLoading: ticketsLoading, isFetching: ticketsFetching } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'ticket-types'),
    queryFn: () => api.get<TicketType[]>('/tickets/types'),
    enabled: Boolean(tenantId),
    staleTime: 0,
  });

  const { data: parkStatus } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'park-day', orderDate),
    queryFn: () => api.get<ParkDayStatus>(`/operations/day?date=${orderDate}`),
    enabled: Boolean(tenantId),
  });

  const catalogLoading = !tenantId || ticketsLoading || (ticketsFetching && ticketTypes.length === 0);

  useEffect(() => {
    setCart([]);
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponCode('');
    setCompletedOrder(null);
  }, [tenantId]);

  const isOpen = parkStatus?.isOpen ?? parkOpen;

  const createOrder = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<OrderResult>('/pos/orders', data),
    onSuccess: (data) => {
      setCompletedOrder(data);
      setCart([]);
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponError(null);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'dashboard-stats') });
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'orders') });
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'reports-sales-range') });
      toast.success('Order completed!');
      if (data.email?.sent) {
        toast.success('Confirmation email sent to customer');
      } else if (data.email?.error) {
        toast.warning(`Order saved but email failed: ${data.email.error}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const validateCoupon = useMutation({
    mutationFn: (payload: { code: string; orderAmount: number }) =>
      api.post<{
        valid: boolean;
        message?: string;
        discount?: number;
        code?: string;
        description?: string;
        discountType?: string;
        discountValue?: number;
      }>('/coupons/validate', payload),
    onSuccess: (data, variables) => {
      if (!data.valid) {
        setAppliedCoupon(null);
        setCouponError(data.message ?? 'Invalid coupon code');
        toast.error(data.message ?? 'Invalid coupon code');
        return;
      }
      setAppliedCoupon({
        valid: true,
        code: data.code ?? variables.code.toUpperCase(),
        discount: data.discount ?? 0,
        description: data.description,
        discountType: data.discountType ?? 'fixed',
        discountValue: data.discountValue ?? 0,
      });
      setCouponError(null);
      toast.success('Coupon applied');
    },
    onError: (err: Error) => {
      setAppliedCoupon(null);
      setCouponError(err.message);
      toast.error(err.message);
    },
  });

  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, [cart]);

  const addToCart = (ticketType: TicketType) => {
    if (!isOpen) {
      toast.error('Park is closed for this date');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.ticketType.id === ticketType.id);
      if (existing) {
        return prev.map((i) =>
          i.ticketType.id === ticketType.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ticketType, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.ticketType.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
      ).filter((i) => i.quantity > 0)
    );
  };

  const subtotal = cart.reduce((sum, i) => sum + i.ticketType.price * i.quantity, 0);
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  const handleApplyCoupon = () => {
    const code = couponCode.trim();
    if (!code) {
      toast.error('Enter a coupon code');
      return;
    }
    if (subtotal <= 0) {
      toast.error('Add tickets before applying a coupon');
      return;
    }
    validateCoupon.mutate({ code, orderAmount: subtotal });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponCode('');
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (!isOpen) {
      toast.error('Park is closed for this date');
      return;
    }
    createOrder.mutate({
      items: cart.map((i) => ({ ticketTypeId: i.ticketType.id, quantity: i.quantity })),
      orderDate,
      customerName: customerName.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMethod,
      couponCode: appliedCoupon?.code ?? undefined,
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Point of Sale</h1>
          <p className="text-slate-500 mt-1">Select tickets and process payments</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Order Date</label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="mt-1 w-44" />
          </div>
          <ParkDayControl date={orderDate} onStatusChange={setParkOpen} />
        </div>
      </div>

      {!isOpen && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Park is closed for {orderDate}. Orders cannot be placed until the park is opened.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            ) : ticketTypes.length === 0 ? (
              <Card className="col-span-full text-center py-12">
                <p className="text-slate-500">No ticket types for this park. Add products under Tickets.</p>
              </Card>
            ) : (
              ticketTypes.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => addToCart(ticket)}
                disabled={!isOpen}
                className={cn(
                  'group text-left bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card transition-all duration-200',
                  isOpen ? 'hover:shadow-elevated hover:border-slate-300/80 active:scale-[0.98]' : 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: ticket.color }}>
                  ${Math.floor(ticket.price)}
                </div>
                <h3 className="font-semibold text-slate-900">{ticket.name}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{ticket.description}</p>
                <p className="text-xl font-bold text-slate-900 mt-3">{formatCurrency(ticket.price)}</p>
              </button>
            ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Current Order</h2>

            <div className="space-y-3 mb-4 pb-4 border-b border-slate-100">
              <Input label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional" />
              <Input label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Optional — for ticket email" />
              <Input label="Phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Optional" />
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-400 text-sm">Tap a ticket to add to cart</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {cart.map((item) => (
                  <div key={item.ticketType.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{item.ticketType.name}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(item.ticketType.price)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.ticketType.id, -1)} className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.ticketType.id, 1)} className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className="font-semibold text-sm w-16 text-right">{formatCurrency(item.ticketType.price * item.quantity)}</p>
                    <button onClick={() => updateQuantity(item.ticketType.id, -item.quantity)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Coupon code</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. SUMMER20"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (appliedCoupon) setAppliedCoupon(null);
                      setCouponError(null);
                    }}
                    disabled={!!appliedCoupon}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  />
                  {appliedCoupon ? (
                    <Button variant="secondary" onClick={handleRemoveCoupon}>Remove</Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={handleApplyCoupon}
                      loading={validateCoupon.isPending}
                      disabled={!couponCode.trim() || subtotal <= 0}
                    >
                      <Tag className="h-4 w-4" />
                      Apply
                    </Button>
                  )}
                </div>
                {appliedCoupon && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
                    <span className="font-mono font-semibold">{appliedCoupon.code}</span>
                    {appliedCoupon.description && (
                      <span className="text-emerald-700"> — {appliedCoupon.description}</span>
                    )}
                    <span className="block text-xs mt-0.5">
                      Saves {formatCurrency(appliedCoupon.discount)}
                    </span>
                  </div>
                )}
                {couponError && !appliedCoupon && (
                  <p className="text-xs text-red-600">{couponError}</p>
                )}
              </div>

              <div className="flex gap-2">
                {(['cash', 'card'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border text-sm font-medium transition-colors',
                      paymentMethod === method
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {method === 'card' ? <CreditCard className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                    {method === 'card' ? 'Card' : 'Cash'}
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span>−{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                size="xl"
                className="w-full"
                disabled={cart.length === 0 || !isOpen}
                loading={createOrder.isPending}
                onClick={handleCheckout}
              >
                {paymentMethod === 'cash' ? 'Complete cash sale' : 'Charge card'} · {formatCurrency(total)}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={!!completedOrder} onClose={() => setCompletedOrder(null)} title="Payment Successful" size="lg">
        {completedOrder && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-800">Order {completedOrder.order.orderNumber}</p>
                <p className="text-sm text-emerald-600">{formatCurrency(completedOrder.order.total)} paid via {completedOrder.order.paymentMethod}</p>
                {completedOrder.email?.sent && (
                  <p className="text-sm text-emerald-700 mt-1">Confirmation email sent to customer</p>
                )}
                {completedOrder.email?.previewUrl && (
                  <a href={completedOrder.email.previewUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline mt-1 inline-block">
                    View email preview (dev)
                  </a>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {completedOrder.tickets.map((ticket) => (
                <div key={ticket.id} className="text-center p-4 rounded-xl border border-slate-200">
                  <img src={ticket.qrImage} alt="QR" className="w-32 h-32 mx-auto mb-2" />
                  <Badge variant="primary">{ticket.ticketTypeName}</Badge>
                  <p className="text-xs text-slate-500 mt-1">Ticket ID</p>
                  <p className="text-xs font-mono font-semibold text-brand-700">{ticket.ticketCode}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setCompletedOrder(null)}>New Sale</Button>
              <Button className="flex-1" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Tickets</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
