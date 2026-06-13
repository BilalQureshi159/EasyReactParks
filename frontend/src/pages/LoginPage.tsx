import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Waves, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card, Alert } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { getHomeRoute } from '@/components/auth/ProtectedRoute';
import { api } from '@/lib/api';
import { BRANDING } from '@/config/branding';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      api.clearTokens();
      await login(email, password);
      toast.success('Welcome back!');
      navigate(getHomeRoute(useAuthStore.getState().user?.role || 'cashier'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      const friendly =
        message.toLowerCase().includes('invalid credentials')
          ? 'Incorrect email or password. Please try again.'
          : message;
      setError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-300 rounded-full blur-3xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/20 backdrop-blur text-white">
            <Waves className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">{BRANDING.appName}</span>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            The modern platform for<br />parks & entertainment
          </h2>
          <p className="text-lg text-brand-100 max-w-md">
            Ticketing, POS, memberships, and gate scanning — all in one beautiful platform built for speed.
          </p>
        </div>
        <p className="relative text-sm text-brand-200">
          Trusted by waterparks, amusement parks, and family entertainment centers worldwide.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600 text-white">
              <Waves className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-slate-900">{BRANDING.appName}</span>
          </div>

          <Card padding="lg">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
              <p className="mt-2 text-slate-500">Sign in as platform admin or park staff</p>
            </div>

            {error && (
              <Alert variant="error" title="Sign in failed" className="mb-5">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@park.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                required
              />
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-sm text-slate-500">
                <a href="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</a>
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
