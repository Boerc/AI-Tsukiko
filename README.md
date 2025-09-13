# AI-Tsukiko

AI-Tsukiko is a comprehensive Twitch streaming companion application that provides real-time screen analysis, chat interaction, and AI-powered commentary through multiple customizable personalities.

## Features

### 🤖 AI Personalities
- **5 Built-in Personalities**: Tsukiko (friendly), Sassy (sarcastic), Pro Analyst (professional), Hype Beast (energetic), Zen Master (calm)
- **Custom Personalities**: Create and edit your own AI personalities
- **Dynamic Switching**: Change personalities on-the-fly during streams

### 💬 Twitch Integration
- **Real-time Chat Reading**: Monitors Twitch chat messages
- **Interactive Commands**: Responds to chat commands (!ai, !personality, !advice)
- **Automatic Responses**: AI generates contextual responses based on chat activity
- **Moderation Support**: Recognizes moderators and subscribers

### 🖥️ Screen Analysis
- **Real-time Screen Capture**: Monitors OBS output or screen content
- **Vision AI Analysis**: Detects objects, UI elements, and game states
- **Smart Suggestions**: Provides gameplay tips and commentary
- **Live Feedback**: Offers real-time advice based on screen content

### 🔊 Text-to-Speech (TTS)
- **Multi-voice Support**: Different voices for each personality
- **Real-time Speech**: Converts AI responses to speech
- **Queue Management**: Handles multiple TTS requests efficiently
- **Custom Messages**: Manual TTS input for streamers

### 🎯 Web Dashboard
- **Live Screen Preview**: Real-time view of screen analysis
- **Chat Monitoring**: Live Twitch chat display
- **Personality Controls**: Easy personality switching
- **System Status**: Connection and service monitoring
- **Quick Actions**: Instant access to common functions

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Twitch account with bot setup
- OBS Studio (optional, for screen capture)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/Boerc/AI-Tsukiko.git
   cd AI-Tsukiko
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Configuration**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Configure your environment variables:
   ```env
   # Twitch Configuration
   TWITCH_BOT_USERNAME=your_bot_username
   TWITCH_OAUTH_TOKEN=oauth:your_oauth_token
   TWITCH_CHANNELS=your_channel_name
   
   # Google Cloud API (optional, for enhanced TTS/STT)
   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
   
   # Server Configuration
   PORT=3001
   FRONTEND_URL=http://localhost:3000
   
   # OBS Configuration (optional)
   OBS_WS_URL=ws://localhost:4444
   OBS_WS_PASSWORD=your_obs_websocket_password
   ```

4. **Twitch Bot Setup**
   
   - Create a Twitch account for your bot
   - Get OAuth token from https://twitchapps.com/tmi/
   - Add bot account as moderator in your channel

5. **Start the Application**
   
   Development mode:
   ```bash
   # Start backend
   npm run dev
   
   # Start frontend (in another terminal)
   npm run frontend:dev
   ```
   
   Production mode:
   ```bash
   npm run build
   npm start
   ```

## Usage

### Web Interface
1. Open http://localhost:3000 in your browser
2. Monitor the connection status in the header
3. Select active personality from the left panel
4. View live chat messages on the right
5. Monitor screen analysis in the center

### Chat Commands
- `!ai <question>` - Ask the AI a question
- `!personality` - List available personalities
- `!personality <name>` - Change personality (moderators only)
- `!advice` - Get gameplay advice

### TTS Integration
- Use the TTS panel to test voice output
- AI responses are automatically spoken
- Customize voice settings per personality

## Configuration

### Personality Customization
```typescript
{
  name: "Custom Bot",
  description: "Your custom AI personality",
  traits: ["helpful", "knowledgeable"],
  responseStyle: "professional",
  catchphrases: ["Hello there!", "Let's analyze this!"]
}
```

### API Endpoints
- `GET /api/personalities` - List all personalities
- `POST /api/personalities/:id/activate` - Activate personality
- `POST /api/chat/send` - Send chat message
- `GET /api/screen/status` - Screen analysis status
- `POST /api/tts/speak` - Text-to-speech

## Architecture

### Backend Services
- **PersonalityManager**: Handles AI personality logic
- **TwitchChatService**: Manages Twitch chat integration
- **ScreenAnalysisService**: Processes screen capture and analysis
- **TTSService**: Handles text-to-speech functionality

### Frontend Components
- **Dashboard**: System overview and quick actions
- **PersonalitySelector**: Personality management interface
- **ChatPanel**: Live Twitch chat display
- **ScreenPreview**: Real-time screen analysis view
- **TTSPanel**: Text-to-speech controls

### Technology Stack
- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Frontend**: Next.js, React, Tailwind CSS, Socket.IO Client
- **Real-time**: WebSocket communication
- **Integrations**: Twitch TMI, Google Cloud APIs

## API Integration

### Google Cloud Setup (Optional)
1. Create Google Cloud Project
2. Enable Text-to-Speech and Vision APIs
3. Create service account and download credentials
4. Set GOOGLE_APPLICATION_CREDENTIALS in .env

### OBS WebSocket (Optional)
1. Install OBS WebSocket plugin
2. Configure password in OBS settings
3. Update OBS_WS_URL and OBS_WS_PASSWORD in .env

## Development

### Project Structure
```
AI-Tsukiko/
├── src/                    # Backend source code
│   ├── services/          # Core services
│   ├── types/            # TypeScript definitions
│   └── index.ts          # Main server file
├── frontend/             # Next.js frontend
│   ├── src/
│   │   ├── app/         # Next.js app router
│   │   └── components/  # React components
└── package.json         # Root package configuration
```

### Adding New Personalities
1. Add personality definition to PersonalityManager
2. Include response templates and traits
3. Test personality switching via API or frontend

### Extending Screen Analysis
1. Enhance ScreenAnalysisService with new detection logic
2. Add object recognition for specific games
3. Implement custom analysis rules

## Troubleshooting

### Common Issues
1. **Twitch Connection Failed**: Check OAuth token and bot username
2. **Screen Capture Not Working**: Verify OBS WebSocket setup
3. **TTS Not Speaking**: Check audio output settings
4. **Frontend Not Loading**: Ensure backend is running on port 3001

### Debug Mode
Enable debug logging:
```bash
DEBUG=ai-tsukiko:* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting guide
- Review the API documentation

---

**Happy Streaming! 🎮✨**
