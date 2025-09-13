import WebSocket from 'ws';

export type VtsConfig = { host: string; port: number; pluginName: string; pluginAuthor: string; pluginIconUrl: string; authToken: string };

export class VtsController {
  private ws: WebSocket | null = null;
  private config: VtsConfig;
  private connected = false;

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
        // For a real integration, authenticate using the VTS Token system
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  send(payload: unknown): void {
    if (!this.ws || !this.connected) return;
    this.ws.send(JSON.stringify(payload));
  }

  setExpression(parameter: string, weight: number): void {
    this.send({ apiName: 'VTubeStudioPublicAPI', requestID: 'setExp', messageType: 'InjectParameterDataRequest', data: { parameterValues: [{ id: parameter, value: weight }] } });
  }
}

