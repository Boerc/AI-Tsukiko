import WebSocket from 'ws';
export class VtsController {
    ws = null;
    config;
    connected = false;
    constructor(config) {
        this.config = config;
    }
    async connect() {
        const url = `ws://${this.config.host}:${this.config.port}`;
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            this.ws = ws;
            const onError = (err) => { ws.removeAllListeners(); reject(err); };
            ws.once('error', onError);
            ws.once('open', async () => {
                ws.off('error', onError);
                this.connected = true;
                // For a real integration, authenticate using the VTS Token system
                resolve();
            });
        });
    }
    async disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.connected = false;
        }
    }
    send(payload) {
        if (!this.ws || !this.connected)
            return;
        this.ws.send(JSON.stringify(payload));
    }
    setExpression(parameter, weight) {
        this.send({ apiName: 'VTubeStudioPublicAPI', requestID: 'setExp', messageType: 'InjectParameterDataRequest', data: { parameterValues: [{ id: parameter, value: weight }] } });
    }
}
