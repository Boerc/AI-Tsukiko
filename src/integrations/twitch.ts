import tmi from 'tmi.js';
import { MemoryStore } from '../memory/memory.js';

export type TwitchConfig = { username: string; oauth: string; channels: string[] };

export type TwitchDeps = {
  memory: MemoryStore;
  chatHandler: (ctx: { channel: string; username: string; message: string; reply: (text: string) => Promise<void> }) => Promise<void>;
  onChatCount?: (count: number) => void;
};

export class TwitchBot {
  private client: tmi.Client;
  private deps: TwitchDeps;
  private queue: { channel: string; text: string }[] = [];
  private sending = false;

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
    let counter = 0; let lastTick = Date.now();
    this.client.on('message', async (channel, tags, message, self) => {
      if (self) return;
      // Per-second chat rate counter for highlight detection callbacks
      const now = Date.now();
      if (now - lastTick > 1000) { this.deps.onChatCount?.(counter); counter = 0; lastTick = now; }
      counter++;
      const username = tags['display-name'] || tags.username || 'unknown';
      const reply = async (text: string) => { this.enqueueSay(channel, text); };
      await this.deps.chatHandler({ channel, username, message, reply });
    });
  }

  async disconnect(): Promise<void> {
    this.client.removeAllListeners();
    await this.client.disconnect();
  }

  private enqueueSay(channel: string, text: string) {
    this.queue.push({ channel, text });
    if (!this.sending) this.flushQueue();
  }

  private async flushQueue() {
    this.sending = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try { await this.client.say(item.channel, item.text); } catch {}
      // Twitch recommends ~20-30 msgs per 30 sec; we use a conservative 1 msg/sec
      await new Promise(r => setTimeout(r, 1000));
    }
    this.sending = false;
  }
}

