import { create } from 'zustand';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { clearTenantCache } from '@/lib/queryClient';

export type UserRole = 'super_admin' | 'park_owner' | 'manager' | 'cashier' | 'gate_staff';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  tenant: { id: string; name: string; slug: string } | null;
  impersonatedBy?: string | null;
  impersonator?: { id: string; email: string; firstName: string; lastName: string } | null;
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sessionExpired: () => void;
  fetchUser: () => Promise<void>;
  initialize: () => Promise<void>;
  impersonatePark: (tenantId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isImpersonating: false,

  login: async (email, password) => {
    const data = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', { email, password });

    api.setTokens(data.accessToken, data.refreshToken);
    clearTenantCache();
    set({
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
      isImpersonating: false,
    });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    api.clearAllSessions();
    clearTenantCache();
    set({ user: null, isAuthenticated: false, isLoading: false, isImpersonating: false });
  },

  sessionExpired: () => {
    api.clearAllSessions();
    clearTenantCache();
    set({ user: null, isAuthenticated: false, isLoading: false, isImpersonating: false });
    toast.error('Your session has expired. Please sign in again.');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  },

  fetchUser: async () => {
    try {
      const user = await api.get<User>('/auth/me');
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isImpersonating: Boolean(user.impersonatedBy),
      });
    } catch {
      api.clearAllSessions();
      set({ user: null, isAuthenticated: false, isLoading: false, isImpersonating: false });
    }
  },

  initialize: async () => {
    api.loadTokens();
    if (api.getAccessToken()) {
      await useAuthStore.getState().fetchUser();
    } else {
      set({ isLoading: false });
    }
  },

  impersonatePark: async (tenantId) => {
    api.backupSuperAdminTokens();
    const data = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/impersonate', { tenantId });

    api.setTokens(data.accessToken, data.refreshToken);
    clearTenantCache();
    set({
      user: data.user,
      isAuthenticated: true,
      isImpersonating: true,
    });
  },

  stopImpersonation: async () => {
    const restored = api.restoreSuperAdminTokens();
    if (!restored) {
      await useAuthStore.getState().logout();
      return;
    }
    clearTenantCache();
    await useAuthStore.getState().fetchUser();
  },
}));

api.setSessionExpiredHandler(() => {
  useAuthStore.getState().sessionExpired();
});
