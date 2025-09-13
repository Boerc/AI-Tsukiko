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
    await this.client.connect(url, this.config.password, { eventSubscriptions: EventSubscription.All });
    this.connected = true;
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
      await (this.client as unknown as { call: (name: string, args: any) => Promise<any> }).call('CreateRecordMarker', { markerName });
    } catch {
      // Not all OBS versions support this; ignore
    }
  }
}

