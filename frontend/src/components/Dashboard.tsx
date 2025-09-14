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

interface DashboardProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  chatMessageCount: number;
  screenAnalysis: ScreenAnalysis | null;
}

export default function Dashboard({ 
  connectionStatus, 
  chatMessageCount, 
  screenAnalysis 
}: DashboardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'disconnected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'connecting': return '🔄';
      case 'disconnected': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-purple-300">Dashboard</h2>
      
      <div className="space-y-4">
        {/* Connection Status */}
        <div className="bg-white/5 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">System Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Backend</span>
              <div className={`flex items-center gap-2 ${getStatusColor(connectionStatus)}`}>
                <span>{getStatusIcon(connectionStatus)}</span>
                <span className="text-sm font-medium capitalize">{connectionStatus}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Twitch Chat</span>
              <div className={`flex items-center gap-2 ${connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                <span>{connectionStatus === 'connected' ? '✅' : '❌'}</span>
                <span className="text-sm font-medium">
                  {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Screen Analysis</span>
              <div className={`flex items-center gap-2 ${screenAnalysis ? 'text-green-400' : 'text-yellow-400'}`}>
                <span>{screenAnalysis ? '✅' : '🔄'}</span>
                <span className="text-sm font-medium">
                  {screenAnalysis ? 'Active' : 'Starting...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white/5 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Live Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-300">{chatMessageCount}</div>
              <div className="text-xs text-gray-400">Chat Messages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-300">
                {screenAnalysis?.objects.length || 0}
              </div>
              <div className="text-xs text-gray-400">Objects Detected</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/5 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              🔄 Refresh Analysis
            </button>
            <button className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
              💬 Send Greeting
            </button>
            <button className="w-full py-2 px-3 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors">
              🎤 Test TTS
            </button>
          </div>
        </div>

        {/* Current Activity */}
        {screenAnalysis && (
          <div className="bg-white/5 rounded-lg p-4">
            <h3 className="font-medium text-white mb-3">Current Activity</h3>
            <div className="text-sm text-gray-300">
              <p className="mb-2">{screenAnalysis.description}</p>
              {screenAnalysis.gameInfo && (
                <div className="text-xs text-purple-300">
                  Game: {screenAnalysis.gameInfo.title || 'Unknown'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}