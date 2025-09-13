export type AppConfig = {
  host: string;
  port: number;
  dataDir: string;
  google: { projectId: string; location: string };
  discord: { token: string; clientId: string; guildId: string | null };
  obs: { host: string; port: number; password: string };
  vts: { host: string; port: number; pluginName: string; pluginAuthor: string; pluginIconUrl: string; authToken: string };
};

export function loadConfig(): AppConfig {
  const host = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.DASHBOARD_PORT || 8181);
  const dataDir = process.env.DATA_DIR || './data';

  const google = {
    projectId: process.env.GOOGLE_PROJECT_ID || '',
    location: process.env.GOOGLE_LOCATION || 'us-central1'
  };

  const discord = {
    token: process.env.DISCORD_BOT_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    guildId: process.env.DISCORD_GUILD_ID || null
  };

  const obs = {
    host: process.env.OBS_HOST || 'localhost',
    port: Number(process.env.OBS_PORT || 4455),
    password: process.env.OBS_PASSWORD || ''
  };

  const vts = {
    host: process.env.VTS_HOST || 'localhost',
    port: Number(process.env.VTS_PORT || 8001),
    pluginName: process.env.VTS_PLUGIN_NAME || 'TsukikoAI',
    pluginAuthor: process.env.VTS_PLUGIN_AUTHOR || 'Unknown',
    pluginIconUrl: process.env.VTS_PLUGIN_ICON_URL || '',
    authToken: process.env.VTS_AUTH_TOKEN || ''
  };

  return { host, port, dataDir, google, discord, obs, vts };
}

