import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Modal, Input, SkeletonTable,
} from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface TicketType {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  color: string;
  isActive: boolean;
  maxPerOrder: number;
  validDays: number;
}

export function TicketsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TicketType | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: 'day_pass', color: '#3B82F6' });
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  const { data: types = [], isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'ticket-types'),
    queryFn: () => api.get<TicketType[]>('/tickets/types'),
    enabled: Boolean(tenantId),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editing
        ? api.put(`/tickets/types/${editing.id}`, data)
        : api.post('/tickets/types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'ticket-types') });
      setModalOpen(false);
      setEditing(null);
      toast.success(editing ? 'Ticket updated' : 'Ticket created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', category: 'day_pass', color: '#3B82F6' });
    setModalOpen(true);
  };

  const openEdit = (ticket: TicketType) => {
    setEditing(ticket);
    setForm({
      name: ticket.name,
      description: ticket.description || '',
      price: String(ticket.price),
      category: ticket.category,
      color: ticket.color,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      category: form.category,
      color: form.color,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ticket Types</h1>
          <p className="text-slate-500 mt-1">Manage your park's ticket offerings</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Ticket
        </Button>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="p-6"><SkeletonTable /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Valid Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ticket.color }} />
                      <div>
                        <p className="font-medium text-slate-900">{ticket.name}</p>
                        <p className="text-xs font-mono text-brand-600">{ticket.slug}</p>
                        <p className="text-xs text-slate-500">{ticket.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">{ticket.category.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{formatCurrency(ticket.price)}</TableCell>
                  <TableCell>{ticket.validDays} days</TableCell>
                  <TableCell>
                    <Badge variant={ticket.isActive ? 'success' : 'default'}>
                      {ticket.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(ticket)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Ticket' : 'Create Ticket'}
        size="md"
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <p className="text-xs text-slate-500">
            Ticket IDs use this slug + 4-digit number (e.g. adult-day-pass-0001)
          </p>
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Input label="Color" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-12" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} loading={saveMutation.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
