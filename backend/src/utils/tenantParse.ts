import type { Tenant } from '@prisma/client';
import type { ITenant, ISmtpSettings } from '../models/index.js';
import type { UserRole } from '../types/index.js';

const defaultSmtp: ISmtpSettings = {
  enabled: false,
  from: '',
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
};

export function asTenant(tenant: Tenant): ITenant {
  const smtp = (tenant.smtp as ISmtpSettings | null) ?? defaultSmtp;
  const rolePermissions = (tenant.rolePermissions as Partial<Record<UserRole, string[]>> | null) ?? {};

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    description: tenant.description,
    type: tenant.type,
    currency: tenant.currency,
    timezone: tenant.timezone,
    customDomain: tenant.customDomain,
    isActive: tenant.isActive,
    smtp,
    rolePermissions,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

export function parseRolePermissions(value: unknown): Partial<Record<UserRole, string[]>> {
  if (!value || typeof value !== 'object') return {};
  return value as Partial<Record<UserRole, string[]>>;
}
