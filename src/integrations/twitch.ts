import tmi from 'tmi.js';
import { MemoryStore } from '../memory/memory.js';

export type TwitchConfig = { username: string; oauth: string; channels: string[] };

export type TwitchDeps = {
  memory: MemoryStore;
  chatHandler: (ctx: { channel: string; username: string; message: string; reply: (text: string) => Promise<void> }) => Promise<void>;
};

export class TwitchBot {
  private client: tmi.Client;
  private deps: TwitchDeps;

  constructor(cfg: TwitchConfig, deps: TwitchDeps) {
    this.deps = deps;
    this.client = new tmi.Client({
      options: { debug: false },
      connection: { reconnect: true, secure: true },
      identity: { username: cfg.username, password: cfg.oauth },
      channels: cfg.channels
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.client.on('message', async (channel, tags, message, self) => {
      if (self) return;
      const username = tags['display-name'] || tags.username || 'unknown';
      const reply = async (text: string) => { await this.client.say(channel, text); };
      await this.deps.chatHandler({ channel, username, message, reply });
    });
  }

  async disconnect(): Promise<void> {
    this.client.removeAllListeners();
    await this.client.disconnect();
  }
}

