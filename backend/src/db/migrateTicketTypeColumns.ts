import { connectDB, disconnectDB } from './connect.js';
import { prisma } from './prisma.js';
import { ensureTicketTypeSlugs, backfillTicketTypeSequences } from '../services/parkOnboarding.js';

async function main() {
  await connectDB();

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  for (const tenant of tenants) {
    await ensureTicketTypeSlugs(tenant.id);
    await backfillTicketTypeSequences(tenant.id);
    console.log(`  ✓ Ticket type slugs & sequences: ${tenant.name}`);
  }

  console.log('\nTicket type migration complete.');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
