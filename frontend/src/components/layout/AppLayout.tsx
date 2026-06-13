import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { useAuthStore } from '@/stores/auth';

export function AppLayout() {
  const isImpersonating = useAuthStore((s) => s.isImpersonating);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Sidebar />
      <ImpersonationBanner />
      <main className={isImpersonating ? 'pl-64 pt-12' : 'pl-64'}>
        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
