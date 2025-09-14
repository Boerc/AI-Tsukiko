interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  badges: string[];
  isSubscriber: boolean;
  isModerator: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
}

export default function ChatPanel({ messages }: ChatPanelProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 h-[600px] flex flex-col">
      <h2 className="text-xl font-semibold mb-4 text-purple-300">Twitch Chat</h2>
      
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No chat messages yet</p>
            <p className="text-sm">Connect to Twitch to see live chat</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`font-medium ${
                    message.isModerator
                      ? 'text-green-400'
                      : message.isSubscriber
                      ? 'text-purple-400'
                      : 'text-blue-400'
                  }`}
                >
                  {message.username}
                </span>
                
                <div className="flex gap-1">
                  {message.badges.map((badge) => (
                    <span
                      key={badge}
                      className="text-xs bg-gray-600 text-gray-200 px-1 rounded"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <p className="text-white text-sm">{message.message}</p>
            </div>
          ))
        )}
      </div>
      
      <div className="border-t border-white/20 pt-4">
        <div className="text-sm text-gray-400 text-center">
          {messages.length} messages
        </div>
      </div>
    </div>
  );
}