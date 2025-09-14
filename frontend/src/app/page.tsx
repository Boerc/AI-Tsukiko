'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Dashboard from '@/components/Dashboard';
import PersonalitySelector from '@/components/PersonalitySelector';
import ChatPanel from '@/components/ChatPanel';
import ScreenPreview from '@/components/ScreenPreview';
import TTSPanel from '@/components/TTSPanel';

interface Personality {
  id: string;
  name: string;
  description: string;
  traits: string[];
  responseStyle: string;
  catchphrases: string[];
  isActive: boolean;
  isCustom: boolean;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  badges: string[];
  isSubscriber: boolean;
  isModerator: boolean;
}

interface ScreenAnalysis {
  timestamp: Date;
  description: string;
  objects: DetectedObject[];
  gameInfo?: GameInfo;
  suggestions: string[];
}

interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface GameInfo {
  title?: string;
  genre?: string;
  scene?: string;
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [activePersonality, setActivePersonality] = useState<Personality | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [screenAnalysis, setScreenAnalysis] = useState<ScreenAnalysis | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    // Connect to backend socket
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001');
    
    newSocket.on('connect', () => {
      console.log('Connected to backend');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setConnectionStatus('disconnected');
    });

    newSocket.on('personality-change', (personality: Personality) => {
      setActivePersonality(personality);
    });

    newSocket.on('chat-message', (message: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-99), message]); // Keep last 100 messages
    });

    newSocket.on('screen-analysis', (analysis: ScreenAnalysis) => {
      setScreenAnalysis(analysis);
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchPersonalities();

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchPersonalities = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/personalities`);
      const data = await response.json();
      setPersonalities(data);
      
      const activeResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/personalities/active`);
      const activeData = await activeResponse.json();
      setActivePersonality(activeData);
    } catch (error) {
      console.error('Failed to fetch personalities:', error);
    }
  };

  const changePersonality = (personalityId: string) => {
    if (socket) {
      socket.emit('change-personality', personalityId);
    }
  };

  const sendTTSRequest = (text: string, personality?: string) => {
    if (socket) {
      socket.emit('tts-request', { text, personality });
    }
  };

  if (connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Connecting to AI-Tsukiko...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 text-white">
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI-Tsukiko
          </h1>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm font-medium">{connectionStatus}</span>
            </div>
            {activePersonality && (
              <div className="text-sm">
                Active: <span className="font-semibold text-purple-300">{activePersonality.name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          <PersonalitySelector
            personalities={personalities}
            activePersonality={activePersonality}
            onPersonalityChange={changePersonality}
          />
          
          <TTSPanel onTTSRequest={sendTTSRequest} />
          
          <Dashboard 
            connectionStatus={connectionStatus}
            chatMessageCount={chatMessages.length}
            screenAnalysis={screenAnalysis}
          />
        </div>

        {/* Center Column - Screen Preview */}
        <div>
          <ScreenPreview analysis={screenAnalysis} />
        </div>

        {/* Right Column - Chat */}
        <div>
          <ChatPanel messages={chatMessages} />
        </div>
      </div>
    </div>
  );
}
