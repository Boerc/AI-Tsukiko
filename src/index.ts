import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { PersonalityManager } from './services/PersonalityManager';
import { TwitchChatService } from './services/TwitchChatService';
import { ScreenAnalysisService } from './services/ScreenAnalysisService';
import { TTSService } from './services/TTSService';
import { ChatMessage, ScreenAnalysis } from './types';

// Load environment variables
dotenv.config();

class AITsukikoServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  
  // Services
  private personalityManager!: PersonalityManager;
  private twitchChat!: TwitchChatService;
  private screenAnalysis!: ScreenAnalysisService;
  private ttsService!: TTSService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupServiceEventHandlers();
  }

  private initializeServices(): void {
    this.personalityManager = new PersonalityManager();
    
    this.twitchChat = new TwitchChatService({
      username: process.env.TWITCH_BOT_USERNAME || '',
      token: process.env.TWITCH_OAUTH_TOKEN || '',
      channels: process.env.TWITCH_CHANNELS?.split(',') || []
    });

    this.screenAnalysis = new ScreenAnalysisService();
    this.ttsService = new TTSService();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // Serve screenshots
    this.app.use('/screenshots', express.static('/tmp/screenshots'));
    this.app.use('/audio', express.static('/tmp/tts-audio'));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          twitchChat: this.twitchChat.isClientConnected(),
          screenAnalysis: this.screenAnalysis.getAnalysisStatus().isAnalyzing,
          tts: this.ttsService.isServiceEnabled()
        }
      });
    });

    // Personality management
    this.app.get('/api/personalities', (req, res) => {
      res.json(this.personalityManager.getAllPersonalities());
    });

    this.app.get('/api/personalities/active', (req, res) => {
      const active = this.personalityManager.getActivePersonality();
      res.json(active || null);
    });

    this.app.post('/api/personalities/:id/activate', (req, res) => {
      const { id } = req.params;
      const success = this.personalityManager.setActivePersonality(id);
      
      if (success) {
        const personality = this.personalityManager.getActivePersonality();
        this.io.emit('personality-change', personality);
        res.json({ success: true, personality });
      } else {
        res.status(404).json({ success: false, error: 'Personality not found' });
      }
    });

    this.app.post('/api/personalities', (req, res) => {
      try {
        const personalityData = req.body;
        const id = this.personalityManager.createCustomPersonality(personalityData);
        const personality = this.personalityManager.getPersonality(id);
        res.json({ success: true, personality });
      } catch (error) {
        res.status(400).json({ success: false, error: 'Invalid personality data' });
      }
    });

    // Chat endpoints
    this.app.get('/api/chat/status', (req, res) => {
      res.json({
        connected: this.twitchChat.isClientConnected(),
        channels: this.twitchChat.getConnectedChannels(),
        stats: this.twitchChat.getChatStats()
      });
    });

    this.app.post('/api/chat/send', (req, res) => {
      const { message, channel } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const targetChannel = channel || this.twitchChat.getConnectedChannels()[0];
      
      this.twitchChat.sendMessage(targetChannel, message)
        .then(() => res.json({ success: true }))
        .catch(error => res.status(500).json({ error: error.message }));
    });

    // Screen analysis endpoints
    this.app.get('/api/screen/status', (req, res) => {
      res.json(this.screenAnalysis.getAnalysisStatus());
    });

    this.app.post('/api/screen/analyze', async (req, res) => {
      try {
        const analysis = await this.screenAnalysis.analyzeNow();
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze screen' });
      }
    });

    this.app.get('/api/screen/latest', (req, res) => {
      const latestScreenshot = this.screenAnalysis.getLatestScreenshot();
      if (latestScreenshot) {
        res.json({ screenshotPath: latestScreenshot.replace('/tmp', '') });
      } else {
        res.status(404).json({ error: 'No screenshots available' });
      }
    });

    // TTS endpoints
    this.app.post('/api/tts/speak', async (req, res) => {
      const { text, personality } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      try {
        await this.ttsService.speakText(text, personality);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'TTS failed' });
      }
    });

    this.app.get('/api/tts/queue', (req, res) => {
      res.json({
        queueLength: this.ttsService.getQueueLength(),
        enabled: this.ttsService.isServiceEnabled()
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);

      // Send current state to new client
      socket.emit('personality-change', this.personalityManager.getActivePersonality());
      socket.emit('chat-status', {
        connected: this.twitchChat.isClientConnected(),
        channels: this.twitchChat.getConnectedChannels()
      });

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });

      // Handle personality changes from frontend
      socket.on('change-personality', (personalityId: string) => {
        const success = this.personalityManager.setActivePersonality(personalityId);
        if (success) {
          const personality = this.personalityManager.getActivePersonality();
          this.io.emit('personality-change', personality);
        }
      });

      // Handle TTS requests from frontend
      socket.on('tts-request', async (data: { text: string; personality?: string }) => {
        try {
          await this.ttsService.speakText(data.text, data.personality);
        } catch (error) {
          socket.emit('tts-error', { error: 'TTS failed' });
        }
      });
    });
  }

  private setupServiceEventHandlers(): void {
    // Twitch chat events
    this.twitchChat.on('message', (message: ChatMessage) => {
      console.log(`💬 ${message.username}: ${message.message}`);
      
      // Track message for stats
      this.twitchChat.trackMessage(message);
      
      // Handle commands
      const isCommand = this.twitchChat.handleCommand(message);
      
      // Broadcast to frontend
      this.io.emit('chat-message', message);
      
      // Generate AI response for certain messages
      if (!isCommand && Math.random() < 0.1) { // 10% chance to respond
        this.generateAIResponse(message);
      }
    });

    this.twitchChat.on('ai-command', ({ message, query }) => {
      this.generateAIResponse(message, query);
    });

    this.twitchChat.on('personality-command', (message) => {
      const personalities = this.personalityManager.getAllPersonalities();
      const personalityList = personalities.map(p => p.name).join(', ');
      this.twitchChat.sendMessage(
        message.username, 
        `Available personalities: ${personalityList}. Current: ${this.personalityManager.getActivePersonality()?.name}`
      );
    });

    this.twitchChat.on('personality-change-command', ({ message, personalityName }) => {
      const personalities = this.personalityManager.getAllPersonalities();
      const personality = personalities.find(p => 
        p.name.toLowerCase() === personalityName.toLowerCase()
      );
      
      if (personality && this.twitchChat.isUserModerator(message)) {
        this.personalityManager.setActivePersonality(personality.id);
        this.io.emit('personality-change', personality);
        this.twitchChat.sendMessage(
          message.username,
          `Personality changed to ${personality.name}!`
        );
      }
    });

    // Screen analysis events
    this.screenAnalysis.on('analysis', (analysis: ScreenAnalysis) => {
      console.log(`🖥️ Screen analysis: ${analysis.description}`);
      this.io.emit('screen-analysis', analysis);
      
      // Occasionally comment on screen analysis
      if (Math.random() < 0.2) { // 20% chance
        const suggestion = analysis.suggestions[Math.floor(Math.random() * analysis.suggestions.length)];
        this.generateAICommentary(suggestion);
      }
    });

    // TTS events
    this.ttsService.on('speech-synthesized', (data) => {
      this.io.emit('tts-synthesized', data);
    });

    this.ttsService.on('audio-playing', (data) => {
      this.io.emit('audio-playing', data);
    });
  }

  private async generateAIResponse(message: ChatMessage, query?: string): Promise<void> {
    const personality = this.personalityManager.getActivePersonality();
    if (!personality) return;

    const context = query || message.message;
    const response = this.personalityManager.generateResponse(context, message.message);
    
    // Send response to chat
    const channels = this.twitchChat.getConnectedChannels();
    if (channels.length > 0) {
      await this.twitchChat.sendMessage(channels[0], `@${message.username} ${response}`);
    }

    // Also speak the response
    await this.ttsService.speakText(response, personality.id);
  }

  private async generateAICommentary(suggestion: string): Promise<void> {
    const personality = this.personalityManager.getActivePersonality();
    if (!personality) return;

    const commentary = this.personalityManager.generateResponse(suggestion);
    
    // Send to chat
    const channels = this.twitchChat.getConnectedChannels();
    if (channels.length > 0) {
      await this.twitchChat.sendMessage(channels[0], commentary);
    }

    // Speak the commentary
    await this.ttsService.speakText(commentary, personality.id);
  }

  async start(): Promise<void> {
    const port = process.env.PORT || 3001;

    try {
      // Connect to Twitch chat if credentials are provided
      if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN) {
        await this.twitchChat.connect();
      } else {
        console.log('⚠️ Twitch credentials not provided, skipping chat connection');
      }

      // Start screen analysis
      await this.screenAnalysis.startAnalysis(5000); // Every 5 seconds

      // Start server
      this.server.listen(port, () => {
        console.log(`🚀 AI-Tsukiko server running on port ${port}`);
        console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    console.log('🛑 Shutting down AI-Tsukiko server...');
    
    this.twitchChat.disconnect();
    this.screenAnalysis.stopAnalysis();
    
    this.server.close(() => {
      console.log('✅ Server stopped');
    });
  }
}

// Start the server
const server = new AITsukikoServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

// Start the server
server.start().catch(console.error);

export default AITsukikoServer;