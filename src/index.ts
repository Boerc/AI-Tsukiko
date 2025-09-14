import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import http from 'node:http';

import { loadConfig } from './config.js';
import { initializeDatabase } from './memory/db.js';
import { MemoryStore } from './memory/memory.js';
import { GoogleAI } from './integrations/google.js';
import { ObsController } from './integrations/obs.js';
import { VtsController } from './integrations/vts.js';
import { DiscordBot } from './integrations/discordBot.js';
import { registerDashboardRoutes } from './dashboard/routes.js';
import { TwitchBot } from './integrations/twitch.js';
import { defaultModeration, moderateText, moderateTextAdvanced, defaultAdvancedModeration, SlidingWindowRateLimiter, redactPII, buildGoogleSafetySettings } from './moderation/moderation.js';
import { getPersona } from './persona/persona.js';
import { quickSentimentToEmotion, triggerEmotion } from './integrations/vtsEmotions.js';
import { HighlightDetector, HighlightStore } from './analytics/highlights.js';
import { TwitchEventSub, type RedeemAction } from './integrations/twitchEventSub.js';
import { ShowFlowScheduler, type ShowAction, type ShowStep } from './showflow/scheduler.js';
import { apiKeyAuth, basicRateLimit } from './security/auth.js';
import { metrics } from './metrics/metrics.js';
import helmet from 'helmet';
import { MemoryLifecycle } from './memory/lifecycle.js';
import { Summarizer } from './memory/summarizer.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use((req, _res, next) => { metrics.counters.http_requests_total.inc({ path: req.path, method: req.method }); next(); });
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(basicRateLimit(Number(process.env.RATE_LIMIT_PER_MIN || 240)));
app.use('/api', apiKeyAuth());

const server = http.createServer(app);

const config = loadConfig();

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

// Initialize database and services
const db = initializeDatabase(path.join(config.dataDir, 'tsukiko.db'));
const memory = new MemoryStore(db);
const highlights = new HighlightStore(db);
const highlightDetector = new HighlightDetector();
const showflow = new ShowFlowScheduler();
const lifecycle = new MemoryLifecycle(db, config.dataDir);
const google = new GoogleAI({
  projectId: config.google.projectId,
  location: config.google.location
});
const obs = new ObsController({
  host: config.obs.host,
  port: config.obs.port,
  password: config.obs.password
});
const vts = new VtsController({
  host: config.vts.host,
  port: config.vts.port,
  pluginName: config.vts.pluginName,
  pluginAuthor: config.vts.pluginAuthor,
  pluginIconUrl: config.vts.pluginIconUrl,
  authToken: config.vts.authToken
}, {
  getToken: async () => memory.getAllSettings()['vts.token'] || null,
  saveToken: async (t: string) => { memory.setSetting('vts.token', t); }
});
const summarizer = new Summarizer(memory, google);
const discord = new DiscordBot({
  token: config.discord.token,
  clientId: config.discord.clientId,
  guildId: config.discord.guildId ?? undefined,
  tts: {
    synthesizeTextToSpeech: async (text: string, voice?: string) => {
      const t0 = Date.now();
      const buf = await google.synthesizeTextToSpeech(text, voice);
      metrics.histograms.tts_latency_ms.observe({ voice: voice || '' }, Date.now() - t0);
      return buf;
    }
  },
  stt: google,
  memory,
  chat: {
    reply: async (text: string, system?: string) => {
      const t0 = Date.now();
      const level = (memory.getAllSettings()['speech.profanity'] || 'medium') as 'low'|'medium'|'high';
      const resp = await google.chat(redactPII(text), system, buildGoogleSafetySettings(level));
      metrics.histograms.llm_latency_ms.observe({ path: 'discord' }, Date.now() - t0);
      metrics.counters.chat_replies_total.inc({ platform: 'discord' });
      return resp;
    }
  },
  persona: {
    getPersonaId: () => {
      const s = memory.getAllSettings();
      return s['persona.current'] || s['personality.preset'] || 'default';
    },
    getSystemPrompt: (id: string) => getPersona(id).systemPrompt,
    getVoiceFor: (id: string) => getPersona(id).ttsVoice
  }
});

// Optional Twitch bot
let twitch: TwitchBot | null = null;
let eventSub: TwitchEventSub | null = null;
if (config.twitch) {
  const rateLimiter = new SlidingWindowRateLimiter(10_000, 5);
  twitch = new TwitchBot(
    { username: config.twitch.username, oauth: config.twitch.oauth, channels: config.twitch.channels },
    {
      memory,
      chatHandler: async ({ channel, username, message, reply }) => {
        // Moderation (use saved settings)
        const s = memory.getAllSettings();
        const adv = defaultAdvancedModeration();
        adv.enabled = (s['moderation.enabled'] ?? 'true') !== 'false';
        adv.maxCapsPercent = parseInt(s['moderation.maxCapsPercent'] ?? String(adv.maxCapsPercent), 10) || adv.maxCapsPercent;
        adv.maxLength = parseInt(s['moderation.maxLength'] ?? String(adv.maxLength), 10) || adv.maxLength;
        const block = s['moderation.blocklist'] ?? '';
        adv.blocklist = block.split(',').map(x => x.trim()).filter(Boolean);
        const slurs = s['moderation.slurList'] ?? '';
        adv.slurList = slurs.split(',').map(x => x.trim()).filter(Boolean);

        // Rate limit per user
        if (!rateLimiter.allow(`twitch:${channel}:${username}`)) return;

        const mod = moderateTextAdvanced(message, adv);
        if (!mod.allowed) return;

        // Persona
        const personaId = memory.getAllSettings()['persona.current'] || process.env.PERSONALITY_PRESET || 'default';
        const persona = getPersona(personaId);
        const level = (memory.getAllSettings()['speech.profanity'] || 'medium') as 'low'|'medium'|'high';
        const prompt = `${username}: ${redactPII(mod.sanitized || '')}`;
        const system = persona.systemPrompt;
        const t0 = Date.now();
        const response = await google.chat(prompt, system, buildGoogleSafetySettings(level));
        metrics.histograms.llm_latency_ms.observe({ path: 'twitch' }, Date.now() - t0);

        // VTS emotion
        const emotion = quickSentimentToEmotion(response);
        triggerEmotion(vts, emotion);

        // Reply
        const safeReply = response.slice(0, 300);
        await reply(safeReply);
        metrics.counters.chat_replies_total.inc({ platform: 'twitch' });
      }
      ,
      onChatCount: (count: number) => {
        const spike = highlightDetector.recordChatCount(count);
        if (spike) {
          const id = `${Date.now()}`;
          highlights.add(id, Date.now(), 'chat_spike');
          obs.createRecordMarker('chat_spike').catch(() => {});
        }
      }
    }
  );
}

// Basic health and info
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Tsukiko', uptimeSec: Math.round(process.uptime()) });
});

// Prometheus-like metrics (very lightweight placeholder)
app.get('/metrics', (_req, res) => {
  const lines = [
    `process_uptime_seconds ${Math.round(process.uptime())}`,
    `nodejs_memory_rss_bytes ${process.memoryUsage().rss}`,
    metrics.renderAll()
  ];
  res.set('Content-Type', 'text/plain');
  res.send(lines.join('\n'));
});

// Register dashboard and API routes
registerDashboardRoutes(app, { memory, config });

// Lightweight highlights endpoint served here to avoid circular deps
app.get('/api/highlights', (_req, res) => {
  try {
    const list = highlights.list(50);
    res.json({ highlights: list });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Self-test endpoint
app.get('/api/selftest', (_req, res) => {
  const base = {
    obs: obs.getStatus(),
    vts: vts.getStatus(),
    eventsub: eventSub ? eventSub.getExtendedStatus() : { connected: false }
  };
  const done = async () => {
    if (!eventSub) return base;
    const scopes = await eventSub.checkScopes().catch(() => ({ ok: false }));
    return { ...base, eventsubScopes: scopes };
  };
  done().then(x => res.json(x)).catch(e => res.status(500).json({ error: String(e) }));
});

app.post('/api/eventsub/resubscribe', async (_req, res) => {
  try {
    if (!eventSub || !config.twitch?.broadcasterUserId) return res.status(400).json({ error: 'EventSub not configured' });
    await eventSub.subscribeToRedemptions(config.twitch.broadcasterUserId, () => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/eventsub/test', async (req, res) => {
  try {
    const title: string = req.body?.title || 'Test Reward';
    if (!eventSub) return res.status(400).json({ error: 'EventSub not configured' });
    const action = (eventSub as any).getActionForTitle ? (eventSub as any).getActionForTitle(title) : undefined;
    // Reuse the same logic as redemption callback
    if (action) {
      if (action.type === 'vts_expression') { vts.setExpression(action.value, 1.0); setTimeout(() => vts.setExpression(action.value, 0.0), 1200); }
      else if (action.type === 'obs_hotkey') await obs.triggerHotkey(action.value);
      else if (action.type === 'obs_scene') await obs.setScene(action.value);
      else if (action.type === 'toggle_filter') await obs.triggerHotkey(action.value);
      else if (action.type === 'play_sfx') await obs.triggerHotkey(action.value);
      else if (action.type === 'persona') memory.setSetting('persona.current', action.value);
    }
    res.json({ ok: true, title, action: action || null });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/summaries/user', async (req, res) => {
  try {
    const userId: string = req.body?.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const text = await summarizer.summarizeUser(userId);
    res.json({ ok: true, summary: text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/summaries/all', async (_req, res) => {
  try {
    // Summarize users with recent messages
    const rows = (db.prepare('SELECT DISTINCT user_id as id FROM messages WHERE user_id IS NOT NULL AND created_at > ? LIMIT 200').all(Date.now() - 7*24*60*60*1000) as any[]).map(r => r.id).filter(Boolean);
    const results: Record<string, string> = {};
    for (const uid of rows) {
      results[uid] = await summarizer.summarizeUser(uid);
    }
    res.json({ ok: true, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/showflow', (_req, res) => {
  try {
    const stepsRaw = memory.getMemory('showflow.steps', 'global');
    const steps = stepsRaw ? JSON.parse(stepsRaw) as ShowStep[] : [];
    res.json({ steps });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/showflow', (req, res) => {
  try {
    const steps = req.body?.steps ?? [];
    memory.setMemory('showflow.steps', JSON.stringify(steps), 'global');
    // Reload scheduler
    showflow.load(steps, async (a: ShowAction) => {
      if (a.kind === 'obs_scene') await obs.setScene(a.value);
      else if (a.kind === 'obs_hotkey') await obs.triggerHotkey(a.value);
      else if (a.kind === 'vts_expression') { vts.setExpression(a.value, 1.0); setTimeout(() => vts.setExpression(a.value, 0.0), 1200); }
      else if (a.kind === 'persona') memory.setSetting('persona.current', a.value);
      else if (a.kind === 'say') {
        // Use Discord text channel? For now, log
        console.log('ShowFlow say:', a.value);
      }
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Serve static dashboard
app.use('/', express.static(path.join(process.cwd(), 'public')));

const PORT = Number(process.env.DASHBOARD_PORT || 8181);
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, async () => {
  console.log(`Tsukiko dashboard: http://${HOST}:${PORT}`);
  try {
    await obs.connect();
  } catch (err) {
    console.warn('OBS connection failed (continuing):', err);
  }
  try {
    await vts.connect();
  } catch (err) {
    console.warn('VTS connection failed (continuing):', err);
  }
  try {
    await discord.login();
  } catch (err) {
    console.error('Discord login failed:', err);
  }
  // Schedule memory lifecycle jobs
  try { lifecycle.schedule(); } catch {}
  if (twitch) {
    try {
      await twitch.connect();
    } catch (err) {
      console.error('Twitch connect failed:', err);
    }
  }
  if (config.twitch?.clientId && config.twitch.accessToken && config.twitch.broadcasterUserId) {
    try {
      eventSub = new TwitchEventSub({ clientId: config.twitch.clientId, accessToken: config.twitch.accessToken, broadcasterUserId: config.twitch.broadcasterUserId });
      // Load saved redeem mappings
      const settings = memory.getAllSettings();
      const mapEntries = Object.entries(settings).filter(([k]) => k.startsWith('redeem.'));
      for (const [k, v] of mapEntries) {
        const title = k.replace(/^redeem\./, '');
        const [type, value] = String(v).split(':', 2);
        eventSub.setRedeemAction(title, { type: type as any, value });
      }
      await eventSub.subscribeToRedemptions(config.twitch.broadcasterUserId, async (_title, action) => {
        if (!action) return;
        if (action.type === 'vts_expression') {
          vts.setExpression(action.value, 1.0);
          setTimeout(() => vts.setExpression(action.value, 0.0), 1200);
        } else if (action.type === 'obs_hotkey') {
          await obs.triggerHotkey(action.value);
        } else if (action.type === 'obs_scene') {
          await obs.setScene(action.value);
        } else if (action.type === 'toggle_filter') {
          // Placeholder: map to hotkey or future OBS filter API
          await obs.triggerHotkey(action.value);
        } else if (action.type === 'play_sfx') {
          // Placeholder: trigger OBS hotkey or TTS short sound
          await obs.triggerHotkey(action.value);
        } else if (action.type === 'persona') {
          memory.setSetting('persona.current', action.value);
        }
      });
      try {
        const scopeStatus = await eventSub.checkScopes();
        memory.setSetting('eventsub.scopes.ok', scopeStatus.ok ? 'true' : 'false');
        if (!scopeStatus.ok) memory.setSetting('eventsub.scopes.error', scopeStatus.error || '');
        if (!scopeStatus.ok) console.error('[EventSub] Missing scopes:', scopeStatus);
      } catch (e) {
        console.warn('[EventSub] Scope check failed:', e);
      }
    } catch (err) {
      console.error('EventSub init failed:', err);
    }
  }

  // Load show flow from saved memory
  try {
    const stepsRaw = memory.getMemory('showflow.steps', 'global');
    if (stepsRaw) {
      const steps = JSON.parse(stepsRaw) as ShowStep[];
      showflow.load(steps, async (a: ShowAction) => {
        if (a.kind === 'obs_scene') await obs.setScene(a.value);
        else if (a.kind === 'obs_hotkey') await obs.triggerHotkey(a.value);
        else if (a.kind === 'vts_expression') { vts.setExpression(a.value, 1.0); setTimeout(() => vts.setExpression(a.value, 0.0), 1200); }
        else if (a.kind === 'persona') memory.setSetting('persona.current', a.value);
        else if (a.kind === 'say') console.log('ShowFlow say:', a.value);
      });
    }
  } catch (e) {
    console.warn('Failed to load showflow at startup:', e);
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await obs.disconnect().catch(() => {});
  await vts.disconnect().catch(() => {});
  await discord.destroy().catch(() => {});
  if (twitch) await twitch.disconnect().catch(() => {});
  process.exit(0);
});

