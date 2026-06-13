import { prisma } from '../db/prisma.js';
import { toDateString } from '../utils/date.js';

export async function getParkDayStatus(tenantId: string, date: string = toDateString()) {
  const record = await prisma.parkDay.findUnique({
    where: { tenantId_date: { tenantId, date } },
  });
  return {
    date,
    isOpen: record ? record.isOpen : true,
    note: record?.note,
  };
}

export async function assertParkIsOpen(tenantId: string, date: string) {
  const status = await getParkDayStatus(tenantId, date);
  if (!status.isOpen) {
    const err = new Error(`Park is closed for ${date}. Orders cannot be placed.`);
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
}
