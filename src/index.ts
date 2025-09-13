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
import { defaultModeration, moderateText } from './moderation/moderation.js';
import { getPersona } from './persona/persona.js';
import { quickSentimentToEmotion, triggerEmotion } from './integrations/vtsEmotions.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);

const config = loadConfig();

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

// Initialize database and services
const db = initializeDatabase(path.join(config.dataDir, 'tsukiko.db'));
const memory = new MemoryStore(db);
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
if (config.twitch) {
  twitch = new TwitchBot(
    { username: config.twitch.username, oauth: config.twitch.oauth, channels: config.twitch.channels },
    {
      memory,
      chatHandler: async ({ channel, username, message, reply }) => {
        // Moderation
        const modSettings = defaultModeration();
        const mod = moderateText(message, modSettings);
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
    }
  );
}

// Basic health and info
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Tsukiko', uptimeSec: Math.round(process.uptime()) });
});

// Register dashboard and API routes
registerDashboardRoutes(app, { memory, config });

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
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await obs.disconnect().catch(() => {});
  await vts.disconnect().catch(() => {});
  await discord.destroy().catch(() => {});
  if (twitch) await twitch.disconnect().catch(() => {});
  process.exit(0);
});

