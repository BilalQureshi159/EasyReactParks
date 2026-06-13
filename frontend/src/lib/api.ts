const API_BASE = '/api';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onSessionExpired: (() => void) | null = null;
  private isHandlingExpiry = false;

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  backupSuperAdminTokens() {
    const access = localStorage.getItem('accessToken');
    const refresh = localStorage.getItem('refreshToken');
    if (access && refresh) {
      localStorage.setItem('superAdminAccessToken', access);
      localStorage.setItem('superAdminRefreshToken', refresh);
    }
  }

  restoreSuperAdminTokens() {
    const access = localStorage.getItem('superAdminAccessToken');
    const refresh = localStorage.getItem('superAdminRefreshToken');
    if (access && refresh) {
      this.setTokens(access, refresh);
      localStorage.removeItem('superAdminAccessToken');
      localStorage.removeItem('superAdminRefreshToken');
      return true;
    }
    return false;
  }

  hasSuperAdminBackup() {
    return Boolean(localStorage.getItem('superAdminAccessToken'));
  }

  loadTokens() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  clearAllSessions() {
    this.clearTokens();
    localStorage.removeItem('superAdminAccessToken');
    localStorage.removeItem('superAdminRefreshToken');
  }

  getAccessToken() {
    return this.accessToken;
  }

  setSessionExpiredHandler(handler: () => void) {
    this.onSessionExpired = handler;
  }

  private handleSessionExpired() {
    if (this.isHandlingExpiry) return;
    this.isHandlingExpiry = true;
    this.clearAllSessions();
    this.onSessionExpired?.();
    setTimeout(() => {
      this.isHandlingExpiry = false;
    }, 1000);
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      this.accessToken = data.accessToken;
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const isPublicAuth =
      path === '/auth/login'
      || path === '/auth/refresh'
      || path === '/auth/forgot-password'
      || path === '/auth/reset-password';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken && !isPublicAuth) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && this.refreshToken && !isPublicAuth) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Request failed' }));

      if (res.status === 401 && !isPublicAuth) {
        this.handleSessionExpired();
        throw new SessionExpiredError();
      }

      throw new Error(body.error || 'Request failed');
    }

    return res.json();
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
