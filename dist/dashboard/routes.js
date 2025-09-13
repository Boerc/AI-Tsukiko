export function registerDashboardRoutes(app, ctx) {
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
        const { value } = req.body;
        ctx.memory.setMemory(req.params.key, value, 'global');
        res.json({ ok: true });
    });
}
