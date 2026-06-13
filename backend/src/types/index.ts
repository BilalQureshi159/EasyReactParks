export type UserRole = 'super_admin' | 'park_owner' | 'manager' | 'cashier' | 'gate_staff';

export interface JwtPayload {
  userId: string;
  tenantId: string | null;
  email: string;
  role: UserRole;
  impersonatedBy?: string | null;
}

export interface AuthUser {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  impersonatedBy?: string | null;
}

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenant?: TenantContext;
    }
  }
}
