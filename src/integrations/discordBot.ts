import { Client, Events, GatewayIntentBits, Partials, VoiceBasedChannel } from 'discord.js';
import { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, entersState, DiscordGatewayAdapterCreator } from '@discordjs/voice';
import { Readable } from 'node:stream';
import { MemoryStore } from '../memory/memory.js';

export type DiscordBotConfig = { token: string; clientId: string; guildId?: string; tts: { synthesizeTextToSpeech(text: string): Promise<Buffer> }; stt: { transcribeShortAudio(buf: Buffer): Promise<string> }; memory: MemoryStore };

export class DiscordBot {
  private client: Client;
  private config: DiscordBotConfig;

  constructor(config: DiscordBotConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ],
      partials: [Partials.Channel]
    });
    this.registerHandlers();
  }

  private registerHandlers() {
    this.client.on(Events.ClientReady, () => {
      console.log(`Discord logged in as ${this.client.user?.tag}`);
    });

    this.client.on(Events.MessageCreate, async (msg) => {
      if (msg.author.bot) return;
      const userId = this.config.memory.upsertUser('discord', msg.author.id, msg.author.displayName, msg.author.displayAvatarURL());
      this.config.memory.saveMessage({ userId, role: 'user', content: msg.content });
      if (msg.content.startsWith('!say ')) {
        const text = msg.content.slice(5).trim();
        try {
          const audio = await this.config.tts.synthesizeTextToSpeech(text);
          await this.playInAuthorChannel(msg.channelId, msg.guildId!, audio);
        } catch (err) {
          console.error('TTS error:', err);
        }
      }
    });
  }

  async login(): Promise<void> {
    if (!this.config.token) throw new Error('Missing DISCORD_BOT_TOKEN');
    await this.client.login(this.config.token);
  }

  async destroy(): Promise<void> {
    this.client.removeAllListeners();
    this.client.destroy();
  }

  private async playInAuthorChannel(_channelId: string, guildId: string, audio: Buffer): Promise<void> {
    const guild = await this.client.guilds.fetch(guildId);
    const me = guild.members.me;
    const voiceStates = guild.voiceStates.cache;
    const anyChannel = voiceStates.first()?.channel as VoiceBasedChannel | undefined;
    if (!anyChannel) return;
    const connection = joinVoiceChannel({
      channelId: anyChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000).catch(() => {});
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const stream = Readable.from(audio);
    const resource = createAudioResource(stream);
    const sub = connection.subscribe(player);
    player.play(resource);
    await new Promise<void>((resolve) => {
      player.once(AudioPlayerStatus.Idle, () => resolve());
    });
    sub?.unsubscribe();
    connection.destroy();
  }
}

