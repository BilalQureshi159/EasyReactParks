import { prisma } from '../db/prisma.js';
import { slugifyTicketType, uniqueTicketTypeSlug } from '../utils/codes.js';

const WATERPARK_TICKETS = [
  { name: 'Adult Day Pass', slug: 'adult-day-pass', description: 'Full day access for ages 13+', price: 49.99, category: 'day_pass', color: '#3B82F6', sortOrder: 1 },
  { name: 'Child Day Pass', slug: 'child-day-pass', description: 'Full day access for ages 3-12', price: 34.99, category: 'day_pass', color: '#8B5CF6', sortOrder: 2 },
  { name: 'Senior Pass', slug: 'senior-pass', description: 'Discounted access for ages 65+', price: 39.99, category: 'day_pass', color: '#10B981', sortOrder: 3 },
  { name: 'Family Pack', slug: 'family-pack', description: '2 Adults + 2 Children', price: 149.99, category: 'bundle', color: '#F59E0B', sortOrder: 4 },
];

const AMUSEMENT_TICKETS = [
  { name: 'General Admission', slug: 'general-admission', description: 'All-day ride access', price: 59.99, category: 'day_pass', color: '#EF4444', sortOrder: 1 },
  { name: 'Junior Pass', slug: 'junior-pass', description: 'Ages 3-12', price: 39.99, category: 'day_pass', color: '#8B5CF6', sortOrder: 2 },
  { name: 'Ride Bundle', slug: 'ride-bundle', description: '10 ride tokens', price: 29.99, category: 'bundle', color: '#F59E0B', sortOrder: 3 },
];

export async function seedDefaultParkData(tenantId: string, parkType: string) {
  const ticketCount = await prisma.ticketType.count({ where: { tenantId } });
  if (ticketCount === 0) {
    const tickets = parkType === 'amusement_park' ? AMUSEMENT_TICKETS : WATERPARK_TICKETS;
    await prisma.ticketType.createMany({
      data: tickets.map((t) => ({ ...t, tenantId })),
    });
  }

  const planCount = await prisma.membershipPlan.count({ where: { tenantId } });
  if (planCount === 0) {
    await prisma.membershipPlan.createMany({
      data: [
        {
          tenantId,
          name: 'Season Pass',
          description: 'Unlimited visits all season',
          price: 199.99,
          durationDays: 365,
          benefits: ['Unlimited entry', '10% food discount', 'Priority lanes'],
        },
        {
          tenantId,
          name: 'Gold Membership',
          description: 'Premium annual membership',
          price: 349.99,
          durationDays: 365,
          benefits: ['Unlimited entry', '20% food discount', 'Free parking', 'Guest passes x2'],
        },
      ],
    });
  }

  const couponCount = await prisma.coupon.count({ where: { tenantId } });
  if (couponCount === 0) {
    await prisma.coupon.create({
      data: {
        tenantId,
        code: 'WELCOME10',
        description: '10% off first visit',
        discountType: 'percentage',
        discountValue: 10,
        maxUses: 500,
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

export async function ensureTicketTypeSlugs(tenantId: string) {
  const types = await prisma.ticketType.findMany({ where: { tenantId } });
  for (const type of types) {
    const slug = type.slug?.trim()
      ? type.slug
      : await uniqueTicketTypeSlug(tenantId, slugifyTicketType(type.name));
    if (slug !== type.slug) {
      await prisma.ticketType.update({ where: { id: type.id }, data: { slug } });
    }
  }
}

/** Set ticketSeq from existing ticket counts so new IDs continue the sequence. */
export async function backfillTicketTypeSequences(tenantId: string) {
  const types = await prisma.ticketType.findMany({ where: { tenantId } });
  for (const type of types) {
    const issued = await prisma.ticket.count({ where: { ticketTypeId: type.id } });
    if (issued > type.ticketSeq) {
      await prisma.ticketType.update({
        where: { id: type.id },
        data: { ticketSeq: issued },
      });
    }
  }
}
