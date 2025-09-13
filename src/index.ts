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
import { defaultModeration, moderateText, moderateTextAdvanced, defaultAdvancedModeration, SlidingWindowRateLimiter } from './moderation/moderation.js';
import { getPersona } from './persona/persona.js';
import { quickSentimentToEmotion, triggerEmotion } from './integrations/vtsEmotions.js';
import { HighlightDetector, HighlightStore } from './analytics/highlights.js';
import { TwitchEventSub, type RedeemAction } from './integrations/twitchEventSub.js';
import { ShowFlowScheduler, type ShowAction, type ShowStep } from './showflow/scheduler.js';
import { apiKeyAuth, basicRateLimit } from './security/auth.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(basicRateLimit(Number(process.env.RATE_LIMIT_PER_MIN || 240)));
app.use(apiKeyAuth());

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
});
const discord = new DiscordBot({
  token: config.discord.token,
  clientId: config.discord.clientId,
  guildId: config.discord.guildId ?? undefined,
  tts: google,
  stt: google,
  memory
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
        const prompt = `${username}: ${mod.sanitized}`;
        const system = persona.systemPrompt;
        const response = await google.chat(prompt, system);

        // VTS emotion
        const emotion = quickSentimentToEmotion(response);
        triggerEmotion(vts, emotion);

        // Reply
        const safeReply = response.slice(0, 300);
        await reply(safeReply);
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

