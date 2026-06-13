import { NavLink } from 'react-router-dom';
import { Building2, LayoutDashboard, LogOut, Waves, LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { BRANDING } from '@/config/branding';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/parks', icon: Building2, label: 'Parks' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
];

export function AdminSidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200/80 flex flex-col z-50">
      <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200/80">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
          <Waves className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm leading-tight">{BRANDING.appName}</p>
          <p className="text-[11px] text-slate-500 leading-tight">Platform Admin</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200/80">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-slate-900 truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <p className="text-[11px] text-brand-600 font-medium mt-0.5">Super Admin</p>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
