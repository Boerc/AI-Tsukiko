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
    }
    catch (err) {
        console.warn('OBS connection failed (continuing):', err);
    }
    try {
        await vts.connect();
    }
    catch (err) {
        console.warn('VTS connection failed (continuing):', err);
    }
    try {
        await discord.login();
    }
    catch (err) {
        console.error('Discord login failed:', err);
    }
});
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await obs.disconnect().catch(() => { });
    await vts.disconnect().catch(() => { });
    await discord.destroy().catch(() => { });
    process.exit(0);
});
