import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Waves, Calendar, CheckCircle2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button, Card, Input, Badge } from '@/components/ui';

interface TicketType {
  id: string;
  name: string;
  description: string;
  price: number;
  color: string;
}

export function BookingPublicPage() {
  const { slug = 'splash-zone' } = useParams<{ slug: string }>();
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [visitDate, setVisitDate] = useState('');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [confirmed, setConfirmed] = useState<{ bookingNumber: string; total: number; email?: { sent: boolean; previewUrl?: string } } | null>(null);

  const TENANT_SLUG = slug;

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ['public-ticket-types', TENANT_SLUG],
    queryFn: () => api.get<TicketType[]>(`/public/${TENANT_SLUG}/ticket-types`),
  });

  const bookMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<{ bookingNumber: string; total: number; email?: { sent: boolean; previewUrl?: string } }>(`/public/${TENANT_SLUG}/bookings`, data),
    onSuccess: (data) => {
      setConfirmed(data);
      toast.success('Booking confirmed!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (confirmed) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-8">
        <Card padding="lg" className="max-w-md w-full text-center animate-slide-up">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h1>
          <p className="text-slate-500 mt-2">Your reservation has been confirmed</p>
          <div className="mt-6 p-4 rounded-xl bg-slate-50">
            <p className="text-sm text-slate-500">Booking Number</p>
            <p className="text-xl font-mono font-bold text-slate-900 mt-1">{confirmed.bookingNumber}</p>
            <p className="text-lg font-semibold text-brand-600 mt-2">{formatCurrency(confirmed.total)}</p>
            {confirmed.email?.sent && (
              <p className="text-sm text-emerald-600 mt-3">A confirmation email has been sent to your inbox.</p>
            )}
            {confirmed.email?.previewUrl && (
              <a href={confirmed.email.previewUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline mt-2 inline-block">
                View email preview (dev)
              </a>
            )}
          </div>
          <Button className="mt-6 w-full" onClick={() => { setConfirmed(null); setSelectedTicket(null); }}>
            Book Another Visit
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <header className="bg-white border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center">
            <Waves className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-slate-900">Book Your Visit</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Choose Your Tickets</h1>
          <p className="text-slate-500 mt-2">Select tickets and reserve your visit date</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ticketTypes.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className={cn(
                'text-left p-6 rounded-2xl border-2 transition-all duration-200',
                selectedTicket?.id === ticket.id
                  ? 'border-brand-500 bg-brand-50/50 shadow-card'
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-soft'
              )}
            >
              <div className="w-10 h-10 rounded-xl mb-3 text-white flex items-center justify-center font-bold text-sm"
                style={{ backgroundColor: ticket.color }}>
                ${Math.floor(ticket.price)}
              </div>
              <h3 className="font-semibold text-slate-900">{ticket.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{ticket.description}</p>
              <p className="text-xl font-bold text-slate-900 mt-3">{formatCurrency(ticket.price)}</p>
            </button>
          ))}
        </div>

        {selectedTicket && (
          <Card className="animate-slide-up">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Complete Your Booking</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input label="Full Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                <Input label="Email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                <Input label="Phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                <Input label="Visit Date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium">{selectedTicket.name}</span>
                    <Badge variant="primary">{formatCurrency(selectedTicket.price)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Quantity</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-semibold w-6 text-center">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 mt-4 pt-4 flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold">{formatCurrency(selectedTicket.price * quantity)}</span>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  loading={bookMutation.isPending}
                  onClick={() => bookMutation.mutate({
                    customerName: customer.name,
                    customerEmail: customer.email,
                    customerPhone: customer.phone,
                    visitDate,
                    ticketTypeId: selectedTicket.id,
                    quantity,
                  })}
                >
                  <Calendar className="h-4 w-4" />
                  Confirm Booking
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
