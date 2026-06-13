import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

const roleHomeMap: Record<string, string> = {
  park_owner: '/dashboard',
  manager: '/dashboard',
  cashier: '/pos',
  gate_staff: '/scanner',
  super_admin: '/admin/dashboard',
};

export function ProtectedRoute({
  children,
  mode = 'any',
}: {
  children: React.ReactNode;
  mode?: 'any' | 'super_admin' | 'park';
}) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdminSession = user.role === 'super_admin' && !user.impersonatedBy;
  const isParkSession = Boolean(user.tenant) || Boolean(user.impersonatedBy) || user.role !== 'super_admin';

  if (mode === 'super_admin' && !isSuperAdminSession) {
    return <Navigate to={getHomeRoute(user.role, user.impersonatedBy)} replace />;
  }

  if (mode === 'park' && !isParkSession) {
    return <Navigate to="/admin/parks" replace />;
  }

  return <>{children}</>;
}

export function getHomeRoute(role: string, impersonatedBy?: string | null): string {
  if (impersonatedBy) return '/dashboard';
  return roleHomeMap[role] || '/dashboard';
}
