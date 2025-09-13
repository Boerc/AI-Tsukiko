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
  private broadcasterId: string;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private lastSubscribeTs = 0;

  constructor(cfg: EventSubConfig) {
    const auth = new StaticAuthProvider(cfg.clientId, cfg.accessToken);
    this.api = new ApiClient({ authProvider: auth });
    this.listener = new EventSubWsListener({ apiClient: this.api });
    this.listener.start();
    this.broadcasterId = cfg.broadcasterUserId;
    this.startKeepalive();
  }

  setRedeemAction(title: string, action: RedeemAction) {
    this.redeemsMap.set(title.toLowerCase(), action);
  }

  async subscribeToRedemptions(broadcasterUserId: string, onRedeem: (title: string, action: RedeemAction | undefined) => void) {
    // Use official API route via ApiClient to get user info and ensure token scopes are fine
    try {
      await this.api.users.getUserById(broadcasterUserId);
    } catch (e) {
      // Non-fatal; continue
    }
    // Twurple WS listener has specific subscribe methods; cast if types mismatch
    const sub = (this.listener as any).subscribeToChannelRedemptionAddEvents;
    if (typeof sub === 'function') {
      await sub.call(this.listener, broadcasterUserId, (e: any) => {
        const title: string = e?.rewardTitle ?? '';
        const action = this.redeemsMap.get(title.toLowerCase());
        onRedeem(title, action);
      });
      this.lastSubscribeTs = Date.now();
    }
  }

  private startKeepalive() {
    if (this.keepaliveTimer) return;
    this.keepaliveTimer = setInterval(async () => {
      const since = Date.now() - this.lastSubscribeTs;
      if (since > 10 * 60_000) {
        try { await this.subscribeToRedemptions(this.broadcasterId, () => {}); } catch {}
      }
    }, 60_000);
  }

  getStatus(): { connected: boolean } {
    // Twurple doesn't expose raw ws connected; infer via lastSubscribeTs freshness
    return { connected: Date.now() - this.lastSubscribeTs < 15 * 60_000 };
  }
}

