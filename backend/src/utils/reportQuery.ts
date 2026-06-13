import { z } from 'zod';
import { parseDateRange, toDateString } from './date.js';

export const reportRangeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function parseReportRange(query: { date?: string; startDate?: string; endDate?: string }) {
  const parsed = reportRangeSchema.parse(query);
  const { start, end, singleDate } = parseDateRange(parsed.date, parsed.startDate, parsed.endDate);
  return {
    start,
    end,
    singleDate,
    startDate: singleDate ?? parsed.startDate ?? toDateString(start),
    endDate: singleDate ?? parsed.endDate ?? toDateString(end),
  };
}
