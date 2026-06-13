import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LifeBuoy, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Modal, Input, SkeletonTable, Alert,
} from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';
import { useAuthStore } from '@/stores/auth';
import { usePermissions } from '@/lib/permissions';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  lastMessageAt: string;
  createdAt: string;
}

interface SupportMessage {
  id: string;
  body: string;
  authorType: string;
  createdAt: string;
  authorName: string;
  authorEmail: string;
}

interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
  browserInfo?: string | null;
  pageUrl?: string | null;
}

interface MetaItem { value: string; label: string }

function statusVariant(status: string) {
  switch (status) {
    case 'open': return 'primary' as const;
    case 'in_progress': return 'warning' as const;
    case 'awaiting_park': return 'purple' as const;
    case 'resolved': return 'success' as const;
    case 'closed': return 'default' as const;
    default: return 'default' as const;
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export function SupportPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    subject: '',
    category: 'other',
    priority: 'normal',
    description: '',
    contactName: user?.firstName ? `${user.firstName} ${user.lastName}` : '',
    contactEmail: user?.email || '',
    contactPhone: '',
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 512) : '',
  });

  const { data: meta } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'support-meta'),
    queryFn: () => api.get<{ categories: MetaItem[]; priorities: MetaItem[] }>('/support/meta'),
    enabled: Boolean(tenantId),
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'support-tickets'),
    queryFn: () => api.get<SupportTicket[]>('/support'),
    enabled: Boolean(tenantId),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'support-ticket', selectedId),
    queryFn: () => api.get<SupportTicketDetail>(`/support/${selectedId}`),
    enabled: Boolean(tenantId && selectedId),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<SupportTicket>('/support', data),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'support-tickets') });
      setModalOpen(false);
      setSelectedId(ticket.id);
      toast.success('Support ticket submitted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.post(`/support/${id}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'support-ticket', selectedId) });
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'support-tickets') });
      setReply('');
      toast.success('Reply sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setForm({
      subject: '',
      category: meta?.categories[0]?.value || 'other',
      priority: 'normal',
      description: '',
      contactName: user?.firstName ? `${user.firstName} ${user.lastName}` : '',
      contactEmail: user?.email || '',
      contactPhone: '',
      pageUrl: window.location.href,
      browserInfo: navigator.userAgent.slice(0, 512),
    });
    setModalOpen(true);
  };

  if (selectedId) {
    if (detailLoading || !detail) {
      return (
        <div className="p-12 flex justify-center">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{detail.subject}</h1>
            <p className="text-slate-500 mt-1 font-mono text-sm">{detail.ticketNumber}</p>
          </div>
          <Badge variant={statusVariant(detail.status)}>{formatStatus(detail.status)}</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" padding="lg">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Conversation</h2>
            {detailLoading ? (
              <p className="text-slate-500">Loading…</p>
            ) : (
              <div className="space-y-4">
                {detail.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-4 ${
                      msg.authorType === 'platform'
                        ? 'bg-brand-50 border border-brand-100'
                        : 'bg-slate-50 border border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-slate-900">
                        {msg.authorType === 'platform' ? 'EasyTicketing Support' : msg.authorName}
                      </p>
                      <span className="text-xs text-slate-500">{formatDate(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))}
              </div>
            )}

            {can('support.create') && detail.status !== 'closed' && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <textarea
                  className="w-full min-h-[100px] px-3.5 py-3 rounded-xl border border-slate-200 text-sm resize-y"
                  placeholder="Add a reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    loading={replyMutation.isPending}
                    disabled={!reply.trim()}
                    onClick={() => replyMutation.mutate({ id: detail.id, body: reply.trim() })}
                  >
                    <Send className="h-4 w-4" />
                    Send reply
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card padding="lg" className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Ticket details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium text-slate-900">{detail.category}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Priority</dt>
                <dd className="font-medium text-slate-900">{detail.priority}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Contact</dt>
                <dd className="font-medium text-slate-900">{detail.contactName}</dd>
                <dd className="text-slate-600">{detail.contactEmail}</dd>
                {detail.contactPhone && <dd className="text-slate-600">{detail.contactPhone}</dd>}
              </div>
              <div>
                <dt className="text-slate-500">Opened</dt>
                <dd className="font-medium text-slate-900">{formatDate(detail.createdAt)}</dd>
              </div>
              {detail.pageUrl && (
                <div>
                  <dt className="text-slate-500">Page URL</dt>
                  <dd className="text-slate-600 break-all text-xs">{detail.pageUrl}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support</h1>
          <p className="text-slate-500 mt-1">Contact the EasyTicketing team for help with your park</p>
        </div>
        {can('support.create') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        )}
      </div>

      <Alert variant="info" title="Platform support">
        Submit a ticket with as much detail as possible. When we reply, it will appear in your ticket thread.
      </Alert>

      <Card padding="none">
        {isLoading ? (
          <div className="p-6"><SkeletonTable /></div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <LifeBuoy className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No support tickets yet</p>
            <p className="text-sm text-slate-500 mt-1">Create a ticket when you need help from platform admin.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelectedId(t.id)}
                >
                  <TableCell className="font-mono text-sm text-brand-700">{t.ticketNumber}</TableCell>
                  <TableCell className="font-medium text-slate-900">{t.subject}</TableCell>
                  <TableCell className="capitalize">{t.priority}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(t.status)}>{formatStatus(t.status)}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(t.lastMessageAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New support ticket">
        <div className="space-y-4">
          <Input
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Brief summary of the issue"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <select
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {(meta?.categories || [{ value: 'other', label: 'Other' }]).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
              <select
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {(meta?.priorities || [{ value: 'normal', label: 'Normal' }]).map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              className="w-full min-h-[120px] px-3.5 py-3 rounded-xl border border-slate-200 text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue, steps to reproduce, error messages, etc."
            />
          </div>
          <Input
            label="Contact name"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
          <Input
            label="Contact email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
          <Input
            label="Contact phone (optional)"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          />
          <Button
            className="w-full"
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            Submit ticket
          </Button>
        </div>
      </Modal>
    </div>
  );
}
