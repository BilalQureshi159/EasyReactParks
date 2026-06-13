import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  SkeletonTable,
} from '@/components/ui';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  parkName?: string;
  parkSlug?: string;
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
  description: string;
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

export function AdminSupportPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [reply, setReply] = useState('');
  const queryClient = useQueryClient();

  const { data: meta } = useQuery({
    queryKey: ['admin-support-meta'],
    queryFn: () => api.get<{ statuses: MetaItem[] }>('/admin/support/meta'),
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-support-tickets', statusFilter],
    queryFn: () => api.get<SupportTicket[]>(
      statusFilter ? `/admin/support?status=${statusFilter}` : '/admin/support',
    ),
  });

  const { data: detail } = useQuery({
    queryKey: ['admin-support-ticket', selectedId],
    queryFn: () => api.get<SupportTicketDetail>(`/admin/support/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.post(`/admin/support/${id}/messages`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-ticket', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      setReply('');
      toast.success('Reply sent to park');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/support/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-ticket', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast.success('Status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (selectedId && detail) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{detail.subject}</h1>
            <p className="text-slate-500 mt-1">
              <span className="font-mono text-sm">{detail.ticketNumber}</span>
              {detail.parkName && <> · {detail.parkName}</>}
            </p>
          </div>
          <select
            className="h-10 px-3 rounded-xl border border-slate-200 text-sm"
            value={detail.status}
            onChange={(e) => statusMutation.mutate({ id: detail.id, status: e.target.value })}
          >
            {(meta?.statuses || []).map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" padding="lg">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Conversation</h2>
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
                      {msg.authorType === 'platform' ? 'Platform (you)' : `${msg.authorName} (park)`}
                    </p>
                    <span className="text-xs text-slate-500">{formatDate(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
            </div>

            {detail.status !== 'closed' && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <textarea
                  className="w-full min-h-[100px] px-3.5 py-3 rounded-xl border border-slate-200 text-sm resize-y"
                  placeholder="Reply to the park…"
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

          <Card padding="lg" className="space-y-4 text-sm">
            <h2 className="text-sm font-semibold text-slate-900">Park & contact</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-slate-500">Park</dt>
                <dd className="font-medium">{detail.parkName}</dd>
                <dd className="text-slate-600">{detail.parkSlug}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Contact</dt>
                <dd className="font-medium">{detail.contactName}</dd>
                <dd className="text-slate-600">{detail.contactEmail}</dd>
                {detail.contactPhone && <dd className="text-slate-600">{detail.contactPhone}</dd>}
              </div>
              <div>
                <dt className="text-slate-500">Category / Priority</dt>
                <dd className="font-medium capitalize">{detail.category} · {detail.priority}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Original description</dt>
                <dd className="text-slate-700 whitespace-pre-wrap">{detail.description}</dd>
              </div>
              {detail.browserInfo && (
                <div>
                  <dt className="text-slate-500">Browser</dt>
                  <dd className="text-slate-600 text-xs break-all">{detail.browserInfo}</dd>
                </div>
              )}
              {detail.pageUrl && (
                <div>
                  <dt className="text-slate-500">Page URL</dt>
                  <dd className="text-slate-600 text-xs break-all">{detail.pageUrl}</dd>
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support tickets</h1>
          <p className="text-slate-500 mt-1">Tickets submitted by parks across the platform</p>
        </div>
        <select
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {(meta?.statuses || []).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="p-6"><SkeletonTable /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Park</TableHead>
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
                  <TableCell>{t.parkName}</TableCell>
                  <TableCell className="font-medium">{t.subject}</TableCell>
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
    </div>
  );
}
