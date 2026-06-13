import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const statusCode = (err as Error & { statusCode?: number }).statusCode;
  if (statusCode) {
    return res.status(statusCode).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
}
