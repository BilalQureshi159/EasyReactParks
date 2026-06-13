import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  ShoppingCart,
  Receipt,
  QrCode,
  Calendar,
  Users,
  UserCog,
  Shield,
  Tag,
  BarChart3,
  Settings,
  Waves,
  LogOut,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { NAV_PERMISSIONS, usePermissions } from '@/lib/permissions';
import { NavGroup } from './NavGroup';
import { BRANDING } from '@/config/branding';
import { REPORT_NAV_ITEMS } from '@/config/reportNav';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/orders', icon: Receipt, label: 'Orders' },
  { to: '/scanner', icon: QrCode, label: 'Scanner' },
  { to: '/staff', icon: UserCog, label: 'Staff' },
  { to: '/roles', icon: Shield, label: 'Roles' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/memberships', icon: Users, label: 'Memberships' },
  { to: '/coupons', icon: Tag, label: 'Coupons' },
  { to: '/support', icon: LifeBuoy, label: 'Support' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { can } = usePermissions();

  const filteredNav = navItems.filter((item) => {
    const perm = NAV_PERMISSIONS[item.to];
    return perm ? can(perm) : true;
  });

  const showReports = can('reports.view');

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-100">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-600 text-white">
          <Waves className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">{BRANDING.appName}</h1>
          {user?.tenant && (
            <p className="text-xs text-slate-500 truncate max-w-[140px]">{user.tenant.name}</p>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}

        {showReports && (
          <NavGroup label="Reports" icon={BarChart3} items={[...REPORT_NAV_ITEMS]} />
        )}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
