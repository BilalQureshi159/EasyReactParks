import { prisma } from './prisma.js';

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('MySQL connected');
  } catch (err) {
    console.error('\n❌ Cannot connect to MySQL.\n');

    if ((err as NodeJS.ErrnoException)?.code === 'ECONNREFUSED') {
      console.error('MySQL is not running. Start MySQL and set DATABASE_URL in backend/.env');
      console.error('Example: mysql://user:password@localhost:3306/easyticketing\n');
    } else {
      console.error(err instanceof Error ? err.message : err);
      console.error('\nCheck DATABASE_URL in backend/.env\n');
    }

    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
