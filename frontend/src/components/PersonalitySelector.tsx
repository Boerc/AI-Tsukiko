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

interface PersonalitySelectorProps {
  personalities: Personality[];
  activePersonality: Personality | null;
  onPersonalityChange: (personalityId: string) => void;
}

export default function PersonalitySelector({ 
  personalities, 
  onPersonalityChange 
}: PersonalitySelectorProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-purple-300">Personality Selector</h2>
      
      <div className="space-y-3">
        {personalities.map((personality) => (
          <div
            key={personality.id}
            className={`
              p-3 rounded-lg cursor-pointer transition-all duration-200
              ${personality.isActive 
                ? 'bg-purple-600/50 border-2 border-purple-400' 
                : 'bg-white/5 border border-white/20 hover:bg-white/10'
              }
            `}
            onClick={() => onPersonalityChange(personality.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-white">{personality.name}</h3>
              {personality.isCustom && (
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                  Custom
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-300 mb-2">{personality.description}</p>
            
            <div className="flex flex-wrap gap-1 mb-2">
              {personality.traits.slice(0, 3).map((trait) => (
                <span
                  key={trait}
                  className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded"
                >
                  {trait}
                </span>
              ))}
            </div>
            
            <div className="text-xs text-gray-400">
              Style: <span className="text-purple-300">{personality.responseStyle}</span>
            </div>
          </div>
        ))}
      </div>
      
      <button
        className="w-full mt-4 py-2 px-4 bg-gradient-to-r from-purple-500 to-pink-500 
                   rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 
                   transition-all duration-200"
        onClick={() => {/* TODO: Open personality creation modal */}}
      >
        Create Custom Personality
      </button>
    </div>
  );
}