import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Waves, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card, Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { BRANDING } from '@/config/branding';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post<{
        success: boolean;
        resetUrl?: string;
        previewUrl?: string;
      }>('/auth/forgot-password', { email });

      setSubmitted(true);
      if (res.resetUrl) setDevResetUrl(res.resetUrl);
      if (res.previewUrl) {
        console.log('Password reset email preview:', res.previewUrl);
        toast.message('Dev: check console for email preview URL');
      }
      toast.success('If that email exists, we sent reset instructions.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
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
            <h1 className="text-2xl font-bold text-slate-900">Reset password</h1>
            <p className="mt-2 text-slate-500">Enter your email and we&apos;ll send a reset link.</p>
          </div>

          {error && (
            <Alert variant="error" title="Could not send reset email" className="mb-5">
              {error}
            </Alert>
          )}

          {submitted ? (
            <div className="space-y-4">
              <Alert variant="success" title="Check your email">
                If an account exists for {email}, you will receive a password reset link shortly.
              </Alert>
              {devResetUrl && (
                <Alert variant="info" title="Development reset link">
                  <a href={devResetUrl} className="text-brand-600 underline break-all">{devResetUrl}</a>
                </Alert>
              )}
              <Link to="/login" className="text-sm text-brand-600 hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@park.com"
                required
              />
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Send reset link
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700">Back to sign in</Link>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
