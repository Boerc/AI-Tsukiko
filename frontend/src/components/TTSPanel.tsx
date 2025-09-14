import { useState } from 'react';

interface TTSPanelProps {
  onTTSRequest: (text: string, personality?: string) => void;
}

export default function TTSPanel({ onTTSRequest }: TTSPanelProps) {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if (text.trim()) {
      setIsSpeaking(true);
      onTTSRequest(text.trim());
      
      // Simulate speaking duration
      setTimeout(() => {
        setIsSpeaking(false);
      }, 2000);
    }
  };

  const quickPhrases = [
    "Hello viewers!",
    "Thanks for watching!",
    "Let's keep going!",
    "Great job on that play!",
    "What do you think about this?"
  ];

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-purple-300">Text-to-Speech</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Text to Speak
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className="w-full p-3 bg-white/5 border border-white/20 rounded-lg 
                     text-white placeholder-gray-400 focus:border-purple-400 
                     focus:outline-none resize-none"
            rows={3}
          />
        </div>
        
        <button
          onClick={handleSpeak}
          disabled={!text.trim() || isSpeaking}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200
            ${isSpeaking
              ? 'bg-gray-600 cursor-not-allowed'
              : text.trim()
              ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'
              : 'bg-gray-600 cursor-not-allowed'
            }`}
        >
          {isSpeaking ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Speaking...
            </div>
          ) : (
            '🔊 Speak Text'
          )}
        </button>
        
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Quick Phrases</h3>
          <div className="grid grid-cols-1 gap-2">
            {quickPhrases.map((phrase, index) => (
              <button
                key={index}
                onClick={() => setText(phrase)}
                className="p-2 text-left bg-white/5 hover:bg-white/10 rounded-lg 
                         text-sm text-gray-300 transition-colors"
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}