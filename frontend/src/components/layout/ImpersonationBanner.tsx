import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonation } = useAuthStore();
  const navigate = useNavigate();

  if (!isImpersonating || !user?.tenant) return null;

  const handleExit = async () => {
    await stopImpersonation();
    navigate('/admin/parks');
  };

  return (
    <div className="fixed top-0 left-64 right-0 z-40 bg-amber-500 text-amber-950 px-6 py-2.5 flex items-center justify-between shadow-md">
      <p className="text-sm font-medium">
        Viewing as <span className="font-semibold">{user.tenant.name}</span> park admin
        {user.impersonator && (
          <span className="opacity-80"> — signed in as {user.impersonator.firstName} {user.impersonator.lastName}</span>
        )}
      </p>
      <Button size="sm" variant="secondary" onClick={handleExit} className="bg-white/90 hover:bg-white">
        <LogOut className="h-3.5 w-3.5" />
        Exit park view
      </Button>
    </div>
  );
}
