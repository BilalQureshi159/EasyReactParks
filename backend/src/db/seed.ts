import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from './connect.js';
import { prisma } from './prisma.js';
import { nextAvailableParkCode, slugifyTicketType, uniqueTicketTypeSlug } from '../utils/codes.js';
import { ensureTicketTypeSlugs, backfillTicketTypeSequences } from '../services/parkOnboarding.js';
import { BRANDING } from '../config/branding.js';

const DEMO_PASSWORD = 'Admin123!';

const SUPER_ADMIN = {
  email: BRANDING.platformEmail,
  firstName: 'Platform',
  lastName: 'Admin',
  role: 'super_admin' as const,
};

const PARKS = [
  {
    slug: 'splash-zone',
    parkCode: '12',
    name: 'Splash Zone Waterpark',
    description: 'Family waterpark with slides, wave pool, and lazy river.',
    type: 'waterpark',
    timezone: 'America/New_York',
    users: [
      { email: 'admin@splashzone.com', firstName: 'Alex', lastName: 'Rivera', role: 'park_owner' as const },
      { email: 'cashier@splashzone.com', firstName: 'Sam', lastName: 'Chen', role: 'cashier' as const },
      { email: 'gate@splashzone.com', firstName: 'Jordan', lastName: 'Lee', role: 'gate_staff' as const },
    ],
  },
  {
    slug: 'adventure-peak',
    parkCode: '01',
    name: 'Adventure Peak Amusement',
    description: 'Thrill rides, carnival games, and seasonal events.',
    type: 'amusement_park',
    timezone: 'America/Chicago',
    users: [
      { email: 'admin@adventurepeak.com', firstName: 'Morgan', lastName: 'Blake', role: 'park_owner' as const },
      { email: 'cashier@adventurepeak.com', firstName: 'Riley', lastName: 'Park', role: 'cashier' as const },
    ],
  },
];

async function ensureParkCodes() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  const used = new Set<string>();

  for (const tenant of tenants) {
    const preferred = PARKS.find((p) => p.slug === tenant.slug)?.parkCode;
    let code = preferred ?? tenant.parkCode;

    if (!code || used.has(code)) {
      code = await nextAvailableParkCode([...used]);
    }

    if (code !== tenant.parkCode) {
      await prisma.tenant.update({ where: { id: tenant.id }, data: { parkCode: code } });
    }
    used.add(code);
  }
}

async function ensureAllTicketTypeSlugs() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await ensureTicketTypeSlugs(tenant.id);
    await backfillTicketTypeSequences(tenant.id);
  }
}

async function seedPark(
  park: (typeof PARKS)[number],
  passwordHash: string,
) {
  let tenant = await prisma.tenant.findUnique({ where: { slug: park.slug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: park.slug,
        parkCode: park.parkCode,
        name: park.name,
        description: park.description,
        type: park.type,
        currency: 'USD',
        timezone: park.timezone,
        isActive: true,
      },
    });
    console.log(`  ✓ Park created: ${park.name}`);
  }

  if (tenant.parkCode !== park.parkCode) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { parkCode: park.parkCode },
    });
  }

  for (const u of park.users) {
    const email = u.email.toLowerCase();
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      create: { ...u, email, tenantId: tenant.id, passwordHash, isActive: true },
      update: { ...u, email, passwordHash, isActive: true },
    });
  }

  if (park.slug === 'splash-zone') {
    const ticketCount = await prisma.ticketType.count({ where: { tenantId: tenant.id } });
    if (ticketCount === 0) {
      await prisma.ticketType.createMany({
        data: [
          { tenantId: tenant.id, slug: 'adult-day-pass', name: 'Adult Day Pass', description: 'Full day access for ages 13+', price: 49.99, category: 'day_pass', color: '#3B82F6', sortOrder: 1 },
          { tenantId: tenant.id, slug: 'child-day-pass', name: 'Child Day Pass', description: 'Full day access for ages 3-12', price: 34.99, category: 'day_pass', color: '#8B5CF6', sortOrder: 2 },
          { tenantId: tenant.id, slug: 'senior-pass', name: 'Senior Pass', description: 'Discounted access for ages 65+', price: 39.99, category: 'day_pass', color: '#10B981', sortOrder: 3 },
          { tenantId: tenant.id, slug: 'family-pack', name: 'Family Pack', description: '2 Adults + 2 Children', price: 149.99, category: 'bundle', color: '#F59E0B', sortOrder: 4 },
          { tenantId: tenant.id, slug: 'twilight-pass', name: 'Twilight Pass', description: 'After 4 PM entry', price: 29.99, category: 'day_pass', color: '#EC4899', sortOrder: 5 },
        ],
      });
    }

    const planCount = await prisma.membershipPlan.count({ where: { tenantId: tenant.id } });
    if (planCount === 0) {
      await prisma.membershipPlan.createMany({
        data: [
          { tenantId: tenant.id, name: 'Season Pass', description: 'Unlimited visits all season', price: 199.99, durationDays: 365, benefits: ['Unlimited entry', '10% food discount', 'Priority lanes'] },
          { tenantId: tenant.id, name: 'Gold Membership', description: 'Premium annual membership', price: 349.99, durationDays: 365, benefits: ['Unlimited entry', '20% food discount', 'Free parking', 'Guest passes x2'] },
        ],
      });
    }

    const couponCount = await prisma.coupon.count({ where: { tenantId: tenant.id } });
    if (couponCount === 0) {
      await prisma.coupon.createMany({
        data: [
          { tenantId: tenant.id, code: 'SUMMER20', description: '20% off summer visits', discountType: 'percentage', discountValue: 20, maxUses: 500, validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
          { tenantId: tenant.id, code: 'FAMILY10', description: '$10 off family packs', discountType: 'fixed', discountValue: 10, maxUses: 200, validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
        ],
      });
    }
  }

  return tenant;
}

async function ensureSuperAdmin(passwordHash: string) {
  const superEmail = SUPER_ADMIN.email.toLowerCase();
  const legacyEmails = ['platform@parkflow.com', superEmail];

  let admin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { in: legacyEmails } },
        { role: 'super_admin', tenantId: null },
      ],
    },
  });

  if (!admin) {
    await prisma.user.create({
      data: {
        email: superEmail,
        firstName: SUPER_ADMIN.firstName,
        lastName: SUPER_ADMIN.lastName,
        role: SUPER_ADMIN.role,
        passwordHash,
        isActive: true,
        tenantId: null,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: superEmail,
        firstName: SUPER_ADMIN.firstName,
        lastName: SUPER_ADMIN.lastName,
        role: 'super_admin',
        passwordHash,
        isActive: true,
        tenantId: null,
      },
    });
  }
}

async function seed() {
  await connectDB();

  await ensureParkCodes();
  await ensureAllTicketTypeSlugs();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await ensureSuperAdmin(passwordHash);
  console.log('  ✓ Super admin seeded');

  for (const park of PARKS) {
    await seedPark(park, passwordHash);
  }

  console.log('\n✅ EasyTicketing seed completed!');
  console.log('\nPlatform super admin (password for all): Admin123!');
  console.log(`  • super_admin  ${SUPER_ADMIN.email.toLowerCase()}`);
  console.log('\nPark logins:');
  for (const park of PARKS) {
    console.log(`\n  ${park.name} (${park.slug})`);
    park.users.forEach((u) => console.log(`    • ${u.role.padEnd(12)} ${u.email}`));
  }
  console.log('\nStart: npm install && npm run db:push && npm run db:seed && npm run dev\n');

  await disconnectDB();
}

seed().catch(() => process.exit(1));
