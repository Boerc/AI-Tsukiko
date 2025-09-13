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

