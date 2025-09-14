import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';
export class ObsController {
    client;
    config;
    connected = false;
    constructor(config) {
        this.client = new OBSWebSocket();
        this.config = config;
    }
    async connect() {
        const url = `ws://${this.config.host}:${this.config.port}`;
        await this.client.connect(url, this.config.password, { eventSubscriptions: EventSubscription.All });
        this.connected = true;
    }
    async disconnect() {
        if (!this.connected)
            return;
        await this.client.disconnect();
        this.connected = false;
    }
    async setCurrentScene(sceneName) {
        if (!this.connected)
            return;
        await this.client.call('SetCurrentProgramScene', { sceneName });
    }
    async triggerHotkey(name) {
        if (!this.connected)
            return;
        await this.client.call('TriggerHotkeyByName', { hotkeyName: name });
    }
}
