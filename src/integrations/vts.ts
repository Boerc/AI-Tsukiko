import WebSocket from 'ws';

export type VtsConfig = { host: string; port: number; pluginName: string; pluginAuthor: string; pluginIconUrl: string; authToken: string };
type TokenProvider = { getToken: () => Promise<string | null>; saveToken: (token: string) => Promise<void> };

export class VtsController {
  private ws: WebSocket | null = null;
  private config: VtsConfig;
  private connected = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private tokenProvider: TokenProvider | null = null;

  constructor(config: VtsConfig, tokenProvider?: TokenProvider) {
    this.config = config;
    this.tokenProvider = tokenProvider ?? null;
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
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(String(data));
          this.handleMessage(msg);
        } catch {}
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
    let token = this.config.authToken;
    if (!token && this.tokenProvider) token = (await this.tokenProvider.getToken()) ?? '';
    if (!token) {
      // Request token (requires user approval in VTS)
      this.send({
        apiName: 'VTubeStudioPublicAPI',
        messageType: 'AuthenticationTokenRequest',
        data: { pluginName: this.config.pluginName, pluginDeveloper: this.config.pluginAuthor, pluginIcon: this.config.pluginIconUrl }
      });
      return;
    }
    this.send({
      apiName: 'VTubeStudioPublicAPI',
      messageType: 'AuthenticationRequest',
      data: { pluginName: this.config.pluginName, pluginDeveloper: this.config.pluginAuthor, authenticationToken: token }
    });
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

  private async handleMessage(msg: any) {
    const type = msg?.messageType;
    if (type === 'AuthenticationTokenResponse') {
      const token: string | undefined = msg?.data?.authenticationToken;
      if (token) {
        if (this.tokenProvider) await this.tokenProvider.saveToken(token).catch(() => {});
        this.config.authToken = token;
        // Immediately authenticate with received token
        await this.authenticate();
      }
    }
    // Could handle AuthenticationResponse and log success if needed
  }
}

