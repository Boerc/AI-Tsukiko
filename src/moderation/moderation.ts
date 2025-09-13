export type ModerationSettings = {
  enabled: boolean;
  blocklist: string[];
  maxCapsPercent: number;
  maxLength: number;
};

export type ModerationResult = { allowed: boolean; reason?: string; sanitized?: string };

export function moderateText(input: string, settings: ModerationSettings): ModerationResult {
  if (!settings.enabled) return { allowed: true };
  const trimmed = input.trim();
  if (trimmed.length === 0) return { allowed: false, reason: 'empty' };
  if (trimmed.length > settings.maxLength) return { allowed: false, reason: 'too_long' };
  const caps = trimmed.replace(/[^A-Z]/g, '').length;
  const capsPct = (caps / Math.max(1, trimmed.replace(/[^A-Za-z]/g, '').length)) * 100;
  if (capsPct > settings.maxCapsPercent) return { allowed: false, reason: 'too_many_caps' };
  const lower = trimmed.toLowerCase();
  for (const banned of settings.blocklist) {
    if (!banned) continue;
    if (lower.includes(banned.toLowerCase())) return { allowed: false, reason: 'blocklist' };
  }
  return { allowed: true, sanitized: trimmed };
}

export function defaultModeration(): ModerationSettings {
  return { enabled: true, blocklist: [], maxCapsPercent: 70, maxLength: 400 };
}

// Advanced moderation extensions
const urlRegex = /\bhttps?:\/\/[\w.-]+(?:\/[\w\-./?%&=+#]*)?/i;

export type AdvancedModerationSettings = ModerationSettings & {
  blockUrls: boolean;
  slurList: string[];
  rateLimit: { windowMs: number; maxInWindow: number };
};

export function defaultAdvancedModeration(): AdvancedModerationSettings {
  return {
    ...defaultModeration(),
    blockUrls: true,
    slurList: [],
    rateLimit: { windowMs: 10_000, maxInWindow: 5 }
  };
}

export function moderateTextAdvanced(input: string, settings: AdvancedModerationSettings): ModerationResult {
  const base = moderateText(input, settings);
  if (!base.allowed) return base;
  const text = base.sanitized ?? input;
  if (settings.blockUrls && urlRegex.test(text)) return { allowed: false, reason: 'url_blocked' };
  const lower = text.toLowerCase();
  for (const s of settings.slurList) {
    if (s && lower.includes(s.toLowerCase())) return { allowed: false, reason: 'slur_blocked' };
  }
  return { allowed: true, sanitized: text };
}

export class SlidingWindowRateLimiter {
  private hits: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxInWindow: number;
  constructor(windowMs: number, maxInWindow: number) {
    this.windowMs = windowMs;
    this.maxInWindow = maxInWindow;
  }
  allow(key: string): boolean {
    const now = Date.now();
    const arr = this.hits.get(key) ?? [];
    const fresh = arr.filter(ts => now - ts <= this.windowMs);
    fresh.push(now);
    this.hits.set(key, fresh);
    return fresh.length <= this.maxInWindow;
  }
}

