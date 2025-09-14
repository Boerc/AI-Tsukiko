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

interface ScreenPreviewProps {
  analysis: ScreenAnalysis | null;
}

export default function ScreenPreview({ analysis }: ScreenPreviewProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-purple-300">Screen Analysis</h2>
      
      <div className="space-y-4">
        {/* Screen Preview Area */}
        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">🖥️</div>
            <p>Screen Preview</p>
            <p className="text-sm">OBS capture will appear here</p>
          </div>
        </div>
        
        {/* Analysis Results */}
        {analysis ? (
          <div className="space-y-3">
            <div className="bg-white/5 rounded-lg p-3">
              <h3 className="font-medium text-purple-300 mb-2">Description</h3>
              <p className="text-sm text-gray-300">{analysis.description}</p>
            </div>
            
            {analysis.objects.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <h3 className="font-medium text-purple-300 mb-2">Detected Objects</h3>
                <div className="space-y-2">
                  {analysis.objects.map((obj, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">{obj.label}</span>
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                        {(obj.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.suggestions.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <h3 className="font-medium text-purple-300 mb-2">AI Suggestions</h3>
                <ul className="space-y-1">
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-yellow-400 mt-1">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="text-xs text-gray-400 text-center">
              Last updated: {new Date(analysis.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">🔍</div>
            <p>No analysis data yet</p>
            <p className="text-sm">Start screen capture to see analysis</p>
          </div>
        )}
      </div>
      
      <div className="mt-6 flex gap-2">
        <button className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
          Start Capture
        </button>
        <button className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors">
          Stop Capture
        </button>
      </div>
    </div>
  );
}