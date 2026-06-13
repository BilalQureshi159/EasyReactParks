import { customAlphabet } from 'nanoid';
import { prisma } from '../db/prisma.js';

const orderSuffixAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const bookingAlphabet = customAlphabet('0123456789', 8);
const memberAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

/** ET + YY + parkCode + '-' + unique suffix (e.g. ET2612-A7K9X2) */
export function generateOrderNumber(parkCode: string, orderDate?: string): string {
  const yy = orderDate && /^\d{4}-\d{2}-\d{2}$/.test(orderDate)
    ? orderDate.slice(2, 4)
    : new Date().getFullYear().toString().slice(-2);
  const park = parkCode.padStart(2, '0').slice(-2);
  return `ET${yy}${park}-${orderSuffixAlphabet()}`;
}

/** Lowercase slug from ticket type name (e.g. "Adult Day Pass" → "adult-day-pass") */
export function slugifyTicketType(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'ticket';
}

/** Ticket ID: slug + 4-digit sequence (e.g. adult-day-pass-0001) */
export function formatTicketCode(slug: string, sequence: number): string {
  if (sequence < 1 || sequence > 9999) {
    throw new Error('Ticket sequence must be between 1 and 9999 for this type');
  }
  return `${slug}-${String(sequence).padStart(4, '0')}`;
}

export async function uniqueTicketTypeSlug(tenantId: string, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let n = 2;
  while (await prisma.ticketType.findFirst({ where: { tenantId, slug } })) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
  return slug;
}

export async function nextAvailableParkCode(
  existingCodes: string[],
): Promise<string> {
  const used = new Set(existingCodes);
  for (let i = 1; i <= 99; i++) {
    const code = String(i).padStart(2, '0');
    if (!used.has(code)) return code;
  }
  throw new Error('No park codes available (max 99 parks)');
}

export function generateBookingNumber(): string {
  return `BK-${bookingAlphabet()}`;
}

export function generateMemberCode(): string {
  return `MEM-${memberAlphabet()}`;
}
