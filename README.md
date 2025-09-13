# Tsukiko - AI VTuber Framework

Tsukiko is an AI VTuber stack designed to connect Google AI agents, OBS, and VTube Studio with a Discord presence and a configurable web dashboard. It features persistent local memory so Tsukiko can remember users, adapt her personality, and manage profanity filters and speech behavior.

This repository provides a TypeScript/Node baseline you can run locally or in Docker, with integration stubs for:
- Google Cloud AI (Gemini via Vertex, Text-to-Speech, Speech-to-Text)
- OBS websocket
- VTube Studio public API (websocket)
- Discord bot with voice join and TTS playback
- Local SQLite persistence for users, messages, and memories
- Web dashboard on port 8181 for configuration and memory management

Note: This is a working scaffold with safe defaults. You will add your own model prompts, persona presets, expression mapping, and production hardening.

## Quick Start

1) Requirements
- Node 18+ and npm 9+, or Docker
- Google Cloud project with service account JSON key
- OBS with obs-websocket enabled (default port 4455)
- VTube Studio with API enabled
- A Discord application and bot token

2) Clone and configure

```bash
cp .env.example .env
# Edit .env and set Google, Discord, OBS, VTS values
```

3) Install and run (Node)

```bash
npm install
npm run dev
# Open http://localhost:8181
```

4) Or run with Docker

```bash
docker build -t tsukiko .
docker run --rm -p 8181:8181 \
  -e GOOGLE_PROJECT_ID=your-project \
  -e GOOGLE_LOCATION=us-central1 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/keys/key.json \
  -e DISCORD_BOT_TOKEN=xxx \
  -e DISCORD_CLIENT_ID=xxx \
  -e OBS_PASSWORD=xxx \
  -v $(pwd)/data:/app/data \
  -v /absolute/path/to/key.json:/app/keys/key.json:ro \
  tsukiko
```

## Features

- Conversational AI via Google Vertex (Gemini 1.5 Pro)
- TTS (Google Text-to-Speech) and SST/STT (Google Speech-to-Text)
- OBS controller (scene switching, hotkeys)
- VTube Studio controller (websocket; parameter injection stub)
- Discord bot with message handling, TTS speaking in voice
- Persistent local memory (SQLite): users, messages, key-value memories, settings
- Web dashboard on port 8181 with health, settings, and memory endpoints

## Architecture

- `src/index.ts`: App entry. Boot Express, init services, connect to OBS/VTS/Discord, mount dashboard.
- `src/config.ts`: Loads configuration from environment.
- `src/memory/*`: SQLite schema and memory APIs (users, messages, memories, settings).
- `src/integrations/google.ts`: Google AI wrapper for Vertex chat, TTS, STT.
- `src/integrations/obs.ts`: OBS WebSocket client (connect, set scene, trigger hotkeys).
- `src/integrations/vts.ts`: VTube Studio WebSocket stub (connect, set expression parameter).
- `src/integrations/discordBot.ts`: Discord bot with message handler, TTS playback in VC.
- `src/dashboard/routes.ts`: Minimal REST APIs for settings and memory.
- `public/`: Static dashboard (single page) hitting REST endpoints.

Data model (SQLite):
- `users(id, platform, external_id, display_name, avatar_url, created_at)`
- `messages(id, user_id, role, content, created_at)`
- `memories(id, user_id, key, value, scope, updated_at)` with unique `(key, scope, user_id)`
- `settings(key, value, updated_at)`

## Configuration

All configuration is via environment variables. See `.env.example`.

- Server
  - `DASHBOARD_PORT` (default 8181), `HOST` (default 0.0.0.0)
  - `DATA_DIR` (default `./data`)
- Google Cloud
  - `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` (default `us-central1`)
  - `GOOGLE_APPLICATION_CREDENTIALS` absolute path to SA JSON key
- Discord
  - `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` (optional)
- OBS
  - `OBS_HOST` (default `localhost`), `OBS_PORT` (default `4455`), `OBS_PASSWORD`
- VTube Studio
  - `VTS_HOST` (default `localhost`), `VTS_PORT` (default `8001`)
  - `VTS_PLUGIN_NAME`, `VTS_PLUGIN_AUTHOR`, `VTS_PLUGIN_ICON_URL`, `VTS_AUTH_TOKEN`
- Behavior presets
  - `PERSONALITY_PRESET`, `PROFANITY_LEVEL`

Google credentials: Ensure your environment has `GOOGLE_APPLICATION_CREDENTIALS` set to the JSON file path. The container example bind-mounts the key into `/app/keys/key.json`.

## Web Dashboard

Navigate to `http://localhost:8181`. Included endpoints:

- `GET /api/health`: service status
- `GET /api/settings`: return key-value settings
- `POST /api/settings`: set key-values, body JSON
- `GET /api/memory/global/:key`: read a global memory key
- `POST /api/memory/global/:key`: write a global memory key `{ value }`

The static `public/index.html` provides a simple UI to call these APIs.

## Discord Bot

- On startup, the bot logs in if `DISCORD_BOT_TOKEN` is set.
- In any server where the bot exists, typing `!say your text` will attempt to synthesize TTS and play it in the first available voice channel (basic demo behavior).
- The bot persists users/messages into SQLite.

Future:
- Prefer slash commands, richer VC routing (join author’s channel), and SST capture via audio receive.

## OBS and VTube Studio

OBS:
- Connects to `ws://OBS_HOST:OBS_PORT` with password.
- Supports `setCurrentScene(scene)` and `triggerHotkey(name)` in `ObsController`.

VTube Studio:
- Connects to `ws://VTS_HOST:VTS_PORT`.
- Stubbed `setExpression(parameter, weight)` via `InjectParameterDataRequest` payload. Implement proper authentication via VTS token flow and map expressions to model parameters.

## Memory and Personality

Use the dashboard to set global keys like:
- `personality.preset`: e.g., `default`, `friendly`, `tsundere`
- `speech.profanity`: `low`, `medium`, `high`

You can store personal memories as well (API scaffold in `MemoryStore`). Extend routes to expose endpoints for user-scoped memory.

## Development

Scripts:
- `npm run dev`: ts-node-dev with live reload
- `npm run typecheck`: compile check
- `npm run build && npm start`: build to `dist/` and run

Project uses ESM and TypeScript. Prefer Node 18+.

## Docker

The provided `Dockerfile` builds a production image. Mount `data/` to persist memory and bind your Google SA key into the container.

## Roadmap / Where to Improve

- Personality system
  - Structured persona config (tone, style, emotional state, lore)
  - Dynamic prompt construction per user/context
  - Profanity filter layers (pre-LLM input, post-LLM output, TTS sanitization)
- Dialog management
  - Conversation state machine, interruptions, turn-taking, user diarization
  - Multi-modal inputs (chat, Discord VC, future webcam triggers)
- VTS deep integration
  - Full auth/token flow, heartbeat, expression/motion parameter maps
  - Triggers based on chat sentiment or alerts
- OBS automations
  - Scene/programmatic overlays based on conversation context or alerts
- Discord enhancements
  - Slash commands, permissions, channel routing, audio receive and STT
- Memory system
  - Vector search for long-term memory, summaries per user, memory decay
- Safety & privacy
  - Robust content filtering, PII redaction, opt-in memory controls
- Operations
  - Structured logs, metrics, error reporting, health checks
  - Secrets management, production config, horizontal scaling

## Security Notes

- Keep secrets out of git; use `.env`/secret manager.
- Restrict dashboard access (behind auth or VPN) before going public.
- Validate inputs on all routes; rate-limit external APIs.

## License

MIT
