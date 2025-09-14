// Personality types
export interface Personality {
  id: string;
  name: string;
  description: string;
  traits: string[];
  responseStyle: 'friendly' | 'sarcastic' | 'professional' | 'energetic' | 'calm';
  catchphrases: string[];
  isActive: boolean;
  isCustom: boolean;
}

// Chat message types
export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  badges: string[];
  isSubscriber: boolean;
  isModerator: boolean;
}

// Screen analysis types
export interface ScreenAnalysis {
  timestamp: Date;
  description: string;
  objects: DetectedObject[];
  gameInfo?: GameInfo;
  suggestions: string[];
}

export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface GameInfo {
  title?: string;
  genre?: string;
  scene?: string;
}

// TTS/STT types
export interface TTSRequest {
  text: string;
  personality: string;
  voice?: string;
}

export interface STTResult {
  text: string;
  confidence: number;
  timestamp: Date;
}

// Configuration types
export interface AppConfig {
  twitch: {
    botUsername: string;
    oauthToken: string;
    channels: string[];
  };
  google: {
    credentialsPath: string;
  };
  server: {
    port: number;
    frontendUrl: string;
  };
  obs: {
    wsUrl: string;
    wsPassword: string;
  };
}

// WebSocket events
export interface WebSocketEvents {
  'chat-message': ChatMessage;
  'screen-analysis': ScreenAnalysis;
  'tts-request': TTSRequest;
  'stt-result': STTResult;
  'personality-change': { personalityId: string };
  'obs-scene-change': { sceneName: string };
}