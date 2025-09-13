import type express from 'express';
import { MemoryStore } from '../memory/memory.js';
import { AppConfig } from '../config.js';

type Ctx = { memory: MemoryStore; config: AppConfig };

export function registerDashboardRoutes(app: express.Express, ctx: Ctx) {
  app.get('/api/settings', (_req, res) => {
    const settings = ctx.memory.getAllSettings();
    res.json({ settings });
  });

  app.post('/api/settings', (req, res) => {
    const entries = req.body ?? {};
    Object.entries(entries).forEach(([k, v]) => ctx.memory.setSetting(k, String(v)));
    res.json({ ok: true });
  });

  app.get('/api/memory/global/:key', (req, res) => {
    const value = ctx.memory.getMemory(req.params.key, 'global');
    res.json({ key: req.params.key, value });
  });

  app.post('/api/memory/global/:key', (req, res) => {
    const { value } = req.body as { value: string };
    ctx.memory.setMemory(req.params.key, value, 'global');
    res.json({ ok: true });
  });

  app.post('/api/persona', (req, res) => {
    const { id } = req.body as { id: string };
    ctx.memory.setSetting('persona.current', id);
    res.json({ ok: true, id });
  });

  app.post('/api/moderation', (req, res) => {
    const body = req.body ?? {};
    Object.entries(body).forEach(([k, v]) => ctx.memory.setSetting(`moderation.${k}`, String(v)));
    res.json({ ok: true });
  });
}

