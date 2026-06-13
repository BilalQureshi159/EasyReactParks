import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, Save, Shield, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Alert, Button, Card, CardDescription, CardHeader, CardTitle, Input } from '@/components/ui';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

interface SmtpSettings {
  enabled: boolean;
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
}

interface SmtpResponse {
  smtp: SmtpSettings;
  parkName: string;
}

interface ParkSettings {
  name: string;
  slug: string;
  description: string;
  customDomain: string;
  bookingUrl: string;
}

const emptyForm = {
  enabled: false,
  from: '',
  host: '',
  port: '587',
  secure: false,
  user: '',
  pass: '',
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const [form, setForm] = useState(emptyForm);
  const [testEmail, setTestEmail] = useState('');
  const [parkForm, setParkForm] = useState({ name: '', description: '', customDomain: '' });

  const { data, isLoading } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'settings', 'smtp'),
    queryFn: () => api.get<SmtpResponse>('/settings/smtp'),
    enabled: Boolean(tenantId),
  });

  const { data: parkData } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'settings', 'park'),
    queryFn: () => api.get<ParkSettings>('/settings/park'),
    enabled: Boolean(tenantId),
  });

  useEffect(() => {
    if (parkData) {
      setParkForm({
        name: parkData.name,
        description: parkData.description,
        customDomain: parkData.customDomain,
      });
    }
  }, [parkData]);

  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: data.smtp.enabled,
      from: data.smtp.from,
      host: data.smtp.host,
      port: String(data.smtp.port || 587),
      secure: data.smtp.secure,
      user: data.smtp.user,
      pass: '',
    });
  }, [data]);

  const saveParkMutation = useMutation({
    mutationFn: () => api.put<ParkSettings>('/settings/park', parkForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'settings', 'park') });
      toast.success('Park settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put<SmtpResponse>('/settings/smtp', {
        enabled: form.enabled,
        from: form.from,
        host: form.host,
        port: Number(form.port),
        secure: form.secure,
        user: form.user,
        ...(form.pass ? { pass: form.pass } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'settings', 'smtp') });
      toast.success('SMTP settings saved');
      setForm((prev) => ({ ...prev, pass: '' }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: (to: string) =>
      api.post<{ sent: boolean; previewUrl?: string; error?: string }>('/settings/smtp/test', { to }),
    onSuccess: (result) => {
      if (result.sent) {
        toast.success(result.previewUrl ? 'Test email sent — open preview link' : 'Test email sent');
        if (result.previewUrl) {
          window.open(result.previewUrl, '_blank');
        }
      } else {
        toast.error(result.error || 'Failed to send test email');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const needsPassword = form.enabled && !data?.smtp.hasPassword && !form.pass;

  const handleSave = () => {
    if (needsPassword) {
      toast.error('Enter SMTP password to enable email');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Park profile, custom domain, and email for {data?.parkName || parkData?.name || 'your park'}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Globe className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <CardTitle>Park profile</CardTitle>
              <CardDescription>Public booking URL and optional custom domain.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <Input
            label="Park name"
            value={parkForm.name}
            onChange={(e) => setParkForm({ ...parkForm, name: e.target.value })}
          />
          <Input
            label="Description"
            value={parkForm.description}
            onChange={(e) => setParkForm({ ...parkForm, description: e.target.value })}
          />
          <Input
            label="Custom domain"
            placeholder="tickets.yourpark.com"
            value={parkForm.customDomain}
            onChange={(e) => setParkForm({ ...parkForm, customDomain: e.target.value })}
            hint="Point DNS to easyticketing.pk or your park subdomain"
          />
          {parkData?.bookingUrl && (
            <p className="text-sm text-slate-500">
              Booking page: <a href={parkData.bookingUrl} className="text-brand-600 underline" target="_blank" rel="noreferrer">{window.location.origin}{parkData.bookingUrl}</a>
            </p>
          )}
          <Button onClick={() => saveParkMutation.mutate()} loading={saveParkMutation.isPending}>
            <Save className="h-4 w-4" />
            Save park profile
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Mail className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <CardTitle>SMTP Email</CardTitle>
              <CardDescription>
                Order and booking confirmations are sent to customers using these settings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="px-6 pb-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-slate-700">Enable customer emails</span>
            </label>

            {!form.enabled && (
              <Alert variant="info">
                When disabled, customer emails are not sent. In development without SMTP, Ethereal test inbox may still be used if MAIL_ENABLED is on in server .env.
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="From address"
                type="email"
                placeholder="noreply@easyticketing.pk"
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                hint="Shown as the sender on customer emails"
              />
              <Input
                label="SMTP host"
                placeholder="smtp.gmail.com"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
              <Input
                label="SMTP port"
                type="number"
                placeholder="587"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                hint="587 for TLS, 465 for SSL"
              />
              <Input
                label="SMTP username"
                placeholder="your-email@gmail.com"
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
              />
              <div className="sm:col-span-2">
                <Input
                  label="SMTP password"
                  type="password"
                  placeholder={data?.smtp.hasPassword ? '•••••••• (unchanged)' : 'App password or SMTP secret'}
                  value={form.pass}
                  onChange={(e) => setForm({ ...form, pass: e.target.value })}
                  hint={data?.smtp.hasPassword ? 'Leave blank to keep the current password' : 'Required when email is enabled'}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(e) => setForm({ ...form, secure: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">Use SSL/TLS (port 465)</span>
            </label>

            <Alert variant="info">
              <div className="flex gap-2">
                <Shield className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
                <p className="text-sm text-slate-600">
                  Gmail and Outlook require an app-specific password. Credentials are stored per park in your database.
                </p>
              </div>
            </Alert>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4" />
                Save settings
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send test email</CardTitle>
          <CardDescription>Verify SMTP works before going live.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <Input
            className="flex-1"
            type="email"
            placeholder="you@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!testEmail || testMutation.isPending}
            onClick={() => testMutation.mutate(testEmail)}
          >
            <Send className="h-4 w-4" />
            Send test
          </Button>
        </div>
      </Card>
    </div>
  );
}
