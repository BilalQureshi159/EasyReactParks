export function toDateString(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

export function parseDateRange(date?: string, startDate?: string, endDate?: string) {
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    return { start, end, singleDate: date };
  }

  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();
  end.setUTCHours(23, 59, 59, 999);

  return {
    start,
    end,
    singleDate: null as string | null,
  };
}

export function dayBounds(dateStr: string) {
  return {
    start: new Date(`${dateStr}T00:00:00.000Z`),
    end: new Date(`${dateStr}T23:59:59.999Z`),
  };
}
