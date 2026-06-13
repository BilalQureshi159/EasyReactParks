import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Modal, Input, SkeletonTable,
} from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  validUntil: string | null;
  isActive: boolean;
}

export function CouponsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    code: '', description: '', discountType: 'percentage' as 'percentage' | 'fixed', discountValue: '',
  });
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'coupons'),
    queryFn: () => api.get<Coupon[]>('/coupons'),
    enabled: Boolean(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/coupons', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'coupons') });
      setModalOpen(false);
      toast.success('Coupon created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coupons</h1>
          <p className="text-slate-500 mt-1">Discount codes and promotions</p>
        </div>
        <Button onClick={() => { setForm({ code: '', description: '', discountType: 'percentage', discountValue: '' }); setModalOpen(true); }}>
          <Plus className="h-4 w-4" />
          Add Coupon
        </Button>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="p-6"><SkeletonTable /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-mono font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded-lg text-sm">
                      {c.code}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-600">{c.description}</TableCell>
                  <TableCell className="font-semibold">
                    {c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue}`}
                  </TableCell>
                  <TableCell>
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}
                  </TableCell>
                  <TableCell>{c.validUntil ? formatDate(c.validUntil) : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'success' : 'default'}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Coupon">
        <div className="space-y-4">
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
            <select
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-sm"
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percentage' | 'fixed' })}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>
          <Input label="Value" type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => createMutation.mutate({
                code: form.code,
                description: form.description,
                discountType: form.discountType,
                discountValue: parseFloat(form.discountValue),
              })}
              loading={createMutation.isPending}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
