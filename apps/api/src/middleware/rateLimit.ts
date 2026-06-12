import type { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request, prefix: string): string {
  const forwarded = req.app.get('trust proxy') ? req.header('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
  const ip = forwarded || req.ip || req.socket.remoteAddress || 'unknown';
  return `${prefix}:${ip}`;
}

export function rateLimit({ windowMs, max, keyPrefix }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = getClientKey(req, keyPrefix);
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' });
      return;
    }

    next();
  };
}
