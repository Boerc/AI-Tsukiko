import { Client, Events, GatewayIntentBits, Partials, VoiceBasedChannel, ApplicationCommandOptionType, ChatInputCommandInteraction } from 'discord.js';
import { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, entersState, DiscordGatewayAdapterCreator, StreamType } from '@discordjs/voice';
import { Readable } from 'node:stream';
import prism from 'prism-media';
import { MemoryStore } from '../memory/memory.js';

export type DiscordBotConfig = { token: string; clientId: string; guildId?: string; tts: { synthesizeTextToSpeech(text: string, voiceName?: string): Promise<Buffer> }; stt: { transcribeShortAudio(buf: Buffer): Promise<string> }; memory: MemoryStore, chat?: { reply(text: string, system?: string): Promise<string> }, persona?: { getPersonaId(): string, getSystemPrompt(id: string): string, getVoiceFor(id: string): string | undefined } };

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
      this.registerSlashCommands().catch(err => console.error('Register slash failed', err));
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

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      try {
        await this.handleSlash(interaction);
      } catch (err) {
        console.error('Slash handler error:', err);
        if (interaction.deferred || interaction.replied) return;
        await interaction.reply({ content: 'Error handling command', ephemeral: true }).catch(() => {});
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

  private async registerSlashCommands(): Promise<void> {
    const cmds = [
      { name: 'ping', description: 'Ping the bot' },
      { name: 'say', description: 'Have Tsukiko say something (text chat reply)', options: [ { name: 'text', description: 'What to say', type: 3, required: true } ] },
      { name: 'tts', description: 'Speak TTS in your current voice channel', options: [ { name: 'text', description: 'What to speak', type: 3, required: true } ] },
      { name: 'persona', description: 'Switch persona', options: [ { name: 'id', description: 'Persona id (default/evil)', type: 3, required: true } ] },
      { name: 'personas', description: 'List personas' },
      { name: 'join', description: 'Join your current voice channel' },
      { name: 'leave', description: 'Leave voice channel' }
    ];
    try {
      if (this.config.guildId) await this.client.application?.commands.set([], this.config.guildId);
    } catch {}
    if (this.config.guildId) await this.client.application?.commands.set(cmds, this.config.guildId);
    else await this.client.application?.commands.set(cmds);
  }

  private async handleSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.commandName;
    if (name === 'ping') {
      await interaction.reply({ content: 'pong', ephemeral: true });
      return;
    }
    if (name === 'say') {
      const text = interaction.options.getString('text', true);
      if (this.config.chat && this.config.persona) {
        const id = this.config.persona.getPersonaId();
        const system = this.config.persona.getSystemPrompt(id);
        const resp = await this.config.chat.reply(text, system);
        await interaction.reply({ content: resp.slice(0, 1800) });
      } else {
        await interaction.reply({ content: text });
      }
      return;
    }
    if (name === 'persona') {
      const id = interaction.options.getString('id', true);
      this.config.memory.setSetting('persona.current', id);
      await interaction.reply({ content: `Persona set to ${id}`, ephemeral: true });
      return;
    }
    if (name === 'personas') {
      const list = Object.entries(this.config.memory.getAllSettings())
        .filter(([k]) => k.startsWith('persona.custom.'))
        .map(([k]) => k.replace(/^persona\.custom\./, ''));
      await interaction.reply({ content: list.length ? list.join(', ') : 'No custom personas' , ephemeral: true });
      return;
    }
    if (name === 'join' || name === 'tts') {
      const member = await interaction.guild?.members.fetch(interaction.user.id);
      const channelId = member?.voice.channelId;
      if (!channelId) {
        await interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
        return;
      }
      if (name === 'join') {
        await interaction.reply({ content: 'Joining...', ephemeral: true });
        // Silent join by playing 1s of silence
        const silence = Buffer.from([]);
        await this.playInChannel(interaction.guildId!, channelId, silence).catch(() => {});
        return;
      }
      if (name === 'tts') {
        const text = interaction.options.getString('text', true);
        await interaction.deferReply({ ephemeral: true });
        let speak = text;
        if (this.config.chat && this.config.persona) {
          const id = this.config.persona.getPersonaId();
          const system = this.config.persona.getSystemPrompt(id);
          speak = await this.config.chat.reply(text, system);
        }
        const voice = this.config.persona?.getVoiceFor(this.config.persona.getPersonaId()) || undefined;
        const t0 = Date.now();
        const audio = await this.config.tts.synthesizeTextToSpeech(speak, voice);
        // Metrics handled in caller; keep this minimal
        await this.playInChannel(interaction.guildId!, channelId, audio);
        await interaction.editReply({ content: 'Spoken.' });
        return;
      }
    }
    if (name === 'leave') {
      await interaction.reply({ content: 'Leaving (if connected).', ephemeral: true });
      // We create/destroy per speak, so nothing persistent to close here
      return;
    }
  }

  private async playInAuthorChannel(_channelId: string, guildId: string, audio: Buffer): Promise<void> {
    const guild = await this.client.guilds.fetch(guildId);
    const me = guild.members.me;
    const voiceStates = guild.voiceStates.cache;
    const anyChannel = voiceStates.first()?.channel as VoiceBasedChannel | undefined;
    if (!anyChannel) return;
    const connection = joinVoiceChannel({ channelId: anyChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator });
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000).catch(() => {});
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const input = Readable.from(audio);
    const transcoded = new prism.FFmpeg({ args: ['-analyzeduration', '0', '-loglevel', '0', '-f', 'mp3', '-i', 'pipe:0', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'] }).on('error', () => {});
    const opus = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
    const stream = input.pipe(transcoded).pipe(opus);
    const resource = createAudioResource(stream, { inputType: StreamType.Opus });
    const sub = connection.subscribe(player);
    player.play(resource);
    await new Promise<void>((resolve) => {
      player.once(AudioPlayerStatus.Idle, () => resolve());
    });
    sub?.unsubscribe();
    connection.destroy();
  }

  private async playInChannel(guildId: string, channelId: string, audio: Buffer): Promise<void> {
    const guild = await this.client.guilds.fetch(guildId);
    const connection = joinVoiceChannel({ channelId, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator });
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000).catch(() => {});
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const input = Readable.from(audio);
    const transcoded = new prism.FFmpeg({ args: ['-analyzeduration', '0', '-loglevel', '0', '-f', 'mp3', '-i', 'pipe:0', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'] }).on('error', () => {});
    const opus = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
    const stream = input.pipe(transcoded).pipe(opus);
    const resource = createAudioResource(stream, { inputType: StreamType.Opus });
    const sub = connection.subscribe(player);
    player.play(resource);
    await new Promise<void>((resolve) => { player.once(AudioPlayerStatus.Idle, () => resolve()); });
    sub?.unsubscribe();
    connection.destroy();
  }
}

