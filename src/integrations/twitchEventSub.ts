import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { StaticAuthProvider } from '@twurple/auth';

export type RedeemAction = { type: 'vts_expression' | 'obs_hotkey' | 'persona' | 'obs_scene' | 'toggle_filter' | 'play_sfx'; value: string };

export type EventSubConfig = {
  clientId: string;
  accessToken: string;
  broadcasterUserId: string;
};

export class TwitchEventSub {
  private api: ApiClient;
  private listener: EventSubWsListener;
  private redeemsMap: Map<string, RedeemAction> = new Map();

  constructor(cfg: EventSubConfig) {
    const auth = new StaticAuthProvider(cfg.clientId, cfg.accessToken);
    this.api = new ApiClient({ authProvider: auth });
    this.listener = new EventSubWsListener({ apiClient: this.api });
    this.listener.start();
  }

  setRedeemAction(title: string, action: RedeemAction) {
    this.redeemsMap.set(title.toLowerCase(), action);
  }

  async subscribeToRedemptions(broadcasterUserId: string, onRedeem: (title: string, action: RedeemAction | undefined) => void) {
    const listenerAny = this.listener as unknown as { onChannelRedemptionAdd: (id: string, cb: (e: any) => void) => Promise<void> };
    await listenerAny.onChannelRedemptionAdd(broadcasterUserId, (e: any) => {
      const title: string = e.rewardTitle ?? e.rewardTitle?.toString?.() ?? '';
      const action = this.redeemsMap.get(title.toLowerCase());
      onRedeem(title, action);
    });
  }
}

