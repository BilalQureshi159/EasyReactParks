import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Modal, Input, SkeletonTable,
} from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  benefits: string[];
}

interface Membership {
  id: string;
  memberName: string;
  memberEmail: string;
  memberCode: string;
  planName: string;
  expiresAt: string;
  isActive: boolean;
}

export function MembershipsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ planId: '', memberName: '', memberEmail: '' });
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  const { data: plans = [] } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'membership-plans'),
    queryFn: () => api.get<MembershipPlan[]>('/memberships/plans'),
    enabled: Boolean(tenantId),
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'memberships'),
    queryFn: () => api.get<Membership[]>('/memberships'),
    enabled: Boolean(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/memberships', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'memberships') });
      setModalOpen(false);
      toast.success('Membership created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Memberships</h1>
          <p className="text-slate-500 mt-1">Season passes and member programs</p>
        </div>
        <Button onClick={() => { setForm({ planId: plans[0]?.id || '', memberName: '', memberEmail: '' }); setModalOpen(true); }}>
          <Plus className="h-4 w-4" />
          New Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} hover>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Crown className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(plan.price)}</p>
                <p className="text-xs text-slate-500 mt-1">{plan.durationDays} days</p>
                <ul className="mt-3 space-y-1">
                  {plan.benefits?.map((b, i) => (
                    <li key={i} className="text-sm text-slate-600">· {b}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="p-6"><SkeletonTable /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.memberName}</p>
                    <p className="text-xs text-slate-500">{m.memberEmail}</p>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{m.memberCode}</TableCell>
                  <TableCell>{m.planName}</TableCell>
                  <TableCell>{formatDate(m.expiresAt)}</TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? 'success' : 'danger'}>
                      {m.isActive ? 'Active' : 'Expired'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Membership">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Plan</label>
            <select
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-sm"
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
              ))}
            </select>
          </div>
          <Input label="Member Name" value={form.memberName} onChange={(e) => setForm({ ...form, memberName: e.target.value })} />
          <Input label="Email" type="email" value={form.memberEmail} onChange={(e) => setForm({ ...form, memberEmail: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => createMutation.mutate(form)} loading={createMutation.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
