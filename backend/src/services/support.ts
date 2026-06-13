import { prisma } from '../db/prisma.js';

export async function nextSupportTicketNumber(tenantId: string): Promise<string> {
  const count = await prisma.supportTicket.count({ where: { tenantId } });
  return `ST-${String(count + 1).padStart(4, '0')}`;
}

export const SUPPORT_CATEGORIES = [
  { value: 'technical', label: 'Technical issue' },
  { value: 'billing', label: 'Billing & payments' },
  { value: 'account', label: 'Account & access' },
  { value: 'feature', label: 'Feature request' },
  { value: 'pos', label: 'POS / ticketing' },
  { value: 'other', label: 'Other' },
] as const;

export const SUPPORT_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export function mapSupportTicket(ticket: {
  id: string;
  tenantId: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  browserInfo: string | null;
  pageUrl: string | null;
  createdById: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  tenant?: { name: string; slug: string } | null;
  createdBy?: { firstName: string; lastName: string; email: string } | null;
}) {
  return {
    id: ticket.id,
    tenantId: ticket.tenantId,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    description: ticket.description,
    contactName: ticket.contactName,
    contactEmail: ticket.contactEmail,
    contactPhone: ticket.contactPhone,
    browserInfo: ticket.browserInfo,
    pageUrl: ticket.pageUrl,
    createdById: ticket.createdById,
    lastMessageAt: ticket.lastMessageAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    parkName: ticket.tenant?.name,
    parkSlug: ticket.tenant?.slug,
    createdByName: ticket.createdBy
      ? `${ticket.createdBy.firstName} ${ticket.createdBy.lastName}`
      : undefined,
    createdByEmail: ticket.createdBy?.email,
  };
}
