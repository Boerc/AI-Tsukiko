import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { Readable } from 'node:stream';
export class DiscordBot {
    client;
    config;
    constructor(config) {
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
    registerHandlers() {
        this.client.on(Events.ClientReady, () => {
            console.log(`Discord logged in as ${this.client.user?.tag}`);
        });
        this.client.on(Events.MessageCreate, async (msg) => {
            if (msg.author.bot)
                return;
            const userId = this.config.memory.upsertUser('discord', msg.author.id, msg.author.displayName, msg.author.displayAvatarURL());
            this.config.memory.saveMessage({ userId, role: 'user', content: msg.content });
            if (msg.content.startsWith('!say ')) {
                const text = msg.content.slice(5).trim();
                try {
                    const audio = await this.config.tts.synthesizeTextToSpeech(text);
                    await this.playInAuthorChannel(msg.channelId, msg.guildId, audio);
                }
                catch (err) {
                    console.error('TTS error:', err);
                }
            }
        });
    }
    async login() {
        if (!this.config.token)
            throw new Error('Missing DISCORD_BOT_TOKEN');
        await this.client.login(this.config.token);
    }
    async destroy() {
        this.client.removeAllListeners();
        this.client.destroy();
    }
    async playInAuthorChannel(_channelId, guildId, audio) {
        const guild = await this.client.guilds.fetch(guildId);
        const me = guild.members.me;
        const voiceStates = guild.voiceStates.cache;
        const anyChannel = voiceStates.first()?.channel;
        if (!anyChannel)
            return;
        const connection = joinVoiceChannel({
            channelId: anyChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 10_000).catch(() => { });
        const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
        const stream = Readable.from(audio);
        const resource = createAudioResource(stream);
        const sub = connection.subscribe(player);
        player.play(resource);
        await new Promise((resolve) => {
            player.once(AudioPlayerStatus.Idle, () => resolve());
        });
        sub?.unsubscribe();
        connection.destroy();
    }
}
