import * as tmi from 'tmi.js';
import { EventEmitter } from 'events';
import { ChatMessage } from '../types';

export class TwitchChatService extends EventEmitter {
  private client: tmi.Client | null = null;
  private config: {
    username: string;
    token: string;
    channels: string[];
  };
  private isConnected: boolean = false;

  constructor(config: { username: string; token: string; channels: string[] }) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      this.client = new tmi.Client({
        options: { debug: true },
        connection: {
          reconnect: true,
          secure: true
        },
        identity: {
          username: this.config.username,
          password: this.config.token
        },
        channels: this.config.channels
      });

      this.setupEventHandlers();
      
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Connected to Twitch chat');
      
    } catch (error) {
      console.error('❌ Failed to connect to Twitch chat:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('message', (channel: string, userstate: any, message: string, self: boolean) => {
      if (self) return; // Ignore messages from the bot itself

      const chatMessage: ChatMessage = {
        id: userstate.id || `${Date.now()}-${Math.random()}`,
        username: userstate.username || 'Unknown',
        message: message,
        timestamp: new Date(),
        badges: Object.keys(userstate.badges || {}),
        isSubscriber: userstate.subscriber || false,
        isModerator: userstate.mod || false
      };

      this.emit('message', chatMessage);
    });

    this.client.on('connected', (addr: string, port: number) => {
      console.log(`🔗 Connected to Twitch IRC at ${addr}:${port}`);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log(`❌ Disconnected from Twitch chat: ${reason}`);
      this.isConnected = false;
    });

    this.client.on('join', (channel: string, username: string, self: boolean) => {
      if (self) {
        console.log(`✅ Joined channel: ${channel}`);
      }
    });

    this.client.on('part', (channel: string, username: string, self: boolean) => {
      if (self) {
        console.log(`👋 Left channel: ${channel}`);
      }
    });
  }

  async sendMessage(channel: string, message: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Not connected to Twitch chat');
    }

    try {
      await this.client.say(channel, message);
      console.log(`📤 Sent message to ${channel}: ${message}`);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  async sendMessageToAllChannels(message: string): Promise<void> {
    const promises = this.config.channels.map(channel => 
      this.sendMessage(channel, message)
    );
    
    await Promise.all(promises);
  }

  disconnect(): void {
    if (this.client && this.isConnected) {
      this.client.disconnect();
      this.isConnected = false;
      console.log('👋 Disconnected from Twitch chat');
    }
  }

  getConnectedChannels(): string[] {
    return this.config.channels;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  // Chat command handlers
  handleCommand(message: ChatMessage): boolean {
    const command = message.message.toLowerCase().trim();
    
    // Basic commands
    if (command.startsWith('!ai')) {
      const query = message.message.substring(3).trim();
      this.emit('ai-command', { message, query });
      return true;
    }

    if (command === '!personality') {
      this.emit('personality-command', message);
      return true;
    }

    if (command.startsWith('!personality ')) {
      const personalityName = message.message.substring(13).trim();
      this.emit('personality-change-command', { message, personalityName });
      return true;
    }

    if (command === '!advice') {
      this.emit('advice-command', message);
      return true;
    }

    return false;
  }

  // Moderation helpers
  isUserModerator(message: ChatMessage): boolean {
    return message.isModerator || message.badges.includes('broadcaster');
  }

  isUserSubscriber(message: ChatMessage): boolean {
    return message.isSubscriber || message.badges.includes('founder') || 
           message.badges.includes('vip') || this.isUserModerator(message);
  }

  // Chat statistics
  private messageCount: number = 0;
  private userMessages: Map<string, number> = new Map();

  trackMessage(message: ChatMessage): void {
    this.messageCount++;
    const userCount = this.userMessages.get(message.username) || 0;
    this.userMessages.set(message.username, userCount + 1);
  }

  getChatStats() {
    return {
      totalMessages: this.messageCount,
      uniqueUsers: this.userMessages.size,
      topChatters: Array.from(this.userMessages.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([username, count]) => ({ username, count }))
    };
  }

  resetStats(): void {
    this.messageCount = 0;
    this.userMessages.clear();
  }
}