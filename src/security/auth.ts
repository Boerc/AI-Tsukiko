import type { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(): (req: Request, res: Response, next: NextFunction) => void {
  const required = process.env.DASHBOARD_API_KEY?.trim();
  return (req, res, next) => {
    if (!required) return next();
    const header = req.get('x-api-key') || req.get('authorization');
    const key = header?.replace(/^Bearer\s+/i, '')?.trim();
    if (key && key === required) return next();
    res.status(401).json({ error: 'Unauthorized' });
  };
}

export function basicRateLimit(maxPerMin = 120): (req: Request, res: Response, next: NextFunction) => void {
  const hits = new Map<string, { ts: number; count: number }>();
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const rec = hits.get(ip) || { ts: now, count: 0 };
    if (now - rec.ts > 60_000) { rec.ts = now; rec.count = 0; }
    rec.count++;
    hits.set(ip, rec);
    if (rec.count > maxPerMin) return res.status(429).json({ error: 'Too Many Requests' });
    next();
  };
}

// Simple in-memory log buffer
const ring: string[] = [];
export function logLine(line: string) {
  const ts = new Date().toISOString();
  ring.push(`[${ts}] ${line}`);
  if (ring.length > 500) ring.shift();
}
export function getLogs(): string[] { return [...ring]; }

