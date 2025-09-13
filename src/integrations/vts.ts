import WebSocket from 'ws';

export type VtsConfig = { host: string; port: number; pluginName: string; pluginAuthor: string; pluginIconUrl: string; authToken: string };

export class VtsController {
  private ws: WebSocket | null = null;
  private config: VtsConfig;
  private connected = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: VtsConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const url = `ws://${this.config.host}:${this.config.port}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const onError = (err: any) => { ws.removeAllListeners(); reject(err); };
      ws.once('error', onError);
      ws.once('open', async () => {
        ws.off('error', onError);
        this.connected = true;
        try {
          await this.authenticate();
        } catch (e) {
          // continue but warn
          // console.warn('VTS auth failed:', e);
        }
        this.startHeartbeat();
        resolve();
      });
      ws.on('close', () => {
        this.connected = false;
        this.stopHeartbeat();
        setTimeout(() => this.reconnect().catch(() => {}), 2000);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
    this.stopHeartbeat();
  }

  send(payload: unknown): void {
    if (!this.ws || !this.connected) return;
    this.ws.send(JSON.stringify(payload));
  }

  setExpression(parameter: string, weight: number): void {
    this.send({ apiName: 'VTubeStudioPublicAPI', requestID: 'setExp', messageType: 'InjectParameterDataRequest', data: { parameterValues: [{ id: parameter, value: weight }] } });
  }

  private async authenticate(): Promise<void> {
    if (!this.ws) return;
    // If we have token use it; otherwise request
    if (!this.config.authToken) {
      // Request token (one-time, requires user approval in VTS). Here we just noop.
      return;
    }
    const payload = {
      apiName: 'VTubeStudioPublicAPI',
      messageType: 'AuthenticationRequest',
      data: { pluginName: this.config.pluginName, pluginDeveloper: this.config.pluginAuthor, authenticationToken: this.config.authToken }
    };
    this.send(payload);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      this.send({ apiName: 'VTubeStudioPublicAPI', messageType: 'StatisticsRequest' });
    }, 10_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private async reconnect(): Promise<void> {
    try { await this.connect(); } catch {}
  }
}

