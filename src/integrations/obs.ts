import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';

export type ObsConfig = { host: string; port: number; password: string };

export class ObsController {
  private client: OBSWebSocket;
  private config: ObsConfig;
  private connected = false;

  constructor(config: ObsConfig) {
    this.client = new OBSWebSocket();
    this.config = config;
  }

  async connect(): Promise<void> {
    const url = `ws://${this.config.host}:${this.config.port}`;
    try {
      await this.client.connect(url, this.config.password, { eventSubscriptions: EventSubscription.All });
      this.connected = true;
      this.client.on('ConnectionClosed', () => { this.connected = false; this.reconnect().catch(() => {}); });
    } catch (e) {
      this.connected = false;
      setTimeout(() => this.reconnect().catch(() => {}), 2000);
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.disconnect();
    this.connected = false;
  }

  async setCurrentScene(sceneName: string): Promise<void> {
    if (!this.connected) return;
    await this.client.call('SetCurrentProgramScene', { sceneName });
  }

  async triggerHotkey(name: string): Promise<void> {
    if (!this.connected) return;
    await this.client.call('TriggerHotkeyByName', { hotkeyName: name });
  }

  async createRecordMarker(markerName: string): Promise<void> {
    if (!this.connected) return;
    try {
      const raw = this.client as unknown as { call: (name: string, args: any) => Promise<any> };
      if (typeof raw.call === 'function') {
        await raw.call('CreateRecordMarker', { markerName });
      }
    } catch {
      // Not all OBS versions support this; ignore
    }
  }

  async supportsRecordMarker(): Promise<boolean> {
    try {
      await this.createRecordMarker('__probe__');
      return true;
    } catch {
      return false;
    }
  }

  async setScene(sceneName: string): Promise<void> {
    await this.setCurrentScene(sceneName);
  }

  private async reconnect(): Promise<void> {
    const url = `ws://${this.config.host}:${this.config.port}`;
    let delay = 1000;
    for (let i = 0; i < 5; i++) {
      try {
        await this.client.connect(url, this.config.password, { eventSubscriptions: EventSubscription.All });
        this.connected = true;
        return;
      } catch {
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, 15_000);
      }
    }
  }

  getStatus(): { connected: boolean } {
    return { connected: this.connected };
  }

  async listScenes(): Promise<string[]> {
    if (!this.connected) return [];
    try {
      const resp = await this.client.call('GetSceneList');
      const scenes = (resp as any)?.scenes || [];
      return scenes.map((s: any) => s.sceneName).filter(Boolean);
    } catch { return []; }
  }
}

