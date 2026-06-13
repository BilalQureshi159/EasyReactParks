import type { UserRole } from '../types/index.js';

export type { UserRole };

export interface ISmtpSettings {
  enabled: boolean;
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/** Tenant shape used by permissions and settings (not a Mongoose document). */
export interface ITenant {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  currency: string;
  timezone: string;
  customDomain?: string | null;
  isActive: boolean;
  smtp: ISmtpSettings;
  rolePermissions: Partial<Record<UserRole, string[]>>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  orderDate?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  paymentMethod?: string | null;
  couponId?: string | null;
  createdById?: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketType {
  id: string;
  name: string;
  price: number;
  color: string;
  category?: string;
}
