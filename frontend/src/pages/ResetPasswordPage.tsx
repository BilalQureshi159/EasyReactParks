import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Waves, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card, Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { BRANDING } from '@/config/branding';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing reset token. Use the link from your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password updated. You can sign in now.');
      navigate('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-surface-secondary">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600 text-white">
            <Waves className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-slate-900">{BRANDING.appName}</span>
        </div>

        <Card padding="lg">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Set new password</h1>
            <p className="mt-2 text-slate-500">Choose a new password for your account.</p>
          </div>

          {error && (
            <Alert variant="error" title="Could not reset password" className="mb-5">
              {error}
            </Alert>
          )}

          {!token && (
            <Alert variant="warning" title="Invalid link" className="mb-5">
              This reset link is missing a token. Request a new link from the sign-in page.
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
            <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!token}>
              Update password
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700">Back to sign in</Link>
          </form>
        </Card>
      </div>
    </div>
  );
}
