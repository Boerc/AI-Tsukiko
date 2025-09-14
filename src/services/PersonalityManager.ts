import { Personality } from '../types';

export class PersonalityManager {
  private personalities: Map<string, Personality> = new Map();
  private activePersonalityId: string = 'tsukiko';

  constructor() {
    this.initializeDefaultPersonalities();
  }

  private initializeDefaultPersonalities(): void {
    const defaultPersonalities: Personality[] = [
      {
        id: 'tsukiko',
        name: 'Tsukiko',
        description: 'A cheerful and supportive AI companion who loves helping streamers',
        traits: ['supportive', 'cheerful', 'knowledgeable', 'encouraging'],
        responseStyle: 'friendly',
        catchphrases: [
          'Let\'s make this stream amazing!',
          'Great job on that play!',
          'The viewers are loving this!',
          'You\'ve got this!'
        ],
        isActive: true,
        isCustom: false
      },
      {
        id: 'sassy',
        name: 'Sassy',
        description: 'A witty and sarcastic AI with a sharp tongue but good heart',
        traits: ['witty', 'sarcastic', 'clever', 'honest'],
        responseStyle: 'sarcastic',
        catchphrases: [
          'Oh, that was... interesting.',
          'Well, that happened.',
          'Chat is having thoughts about that move.',
          'I mean, if you say so...'
        ],
        isActive: false,
        isCustom: false
      },
      {
        id: 'pro',
        name: 'Pro Analyst',
        description: 'A professional gaming analyst focused on strategy and improvement',
        traits: ['analytical', 'strategic', 'focused', 'educational'],
        responseStyle: 'professional',
        catchphrases: [
          'Let\'s analyze that play.',
          'Consider this strategic approach.',
          'The optimal move here would be...',
          'Based on the current meta...'
        ],
        isActive: false,
        isCustom: false
      },
      {
        id: 'hype',
        name: 'Hype Beast',
        description: 'An energetic AI that gets excited about everything',
        traits: ['energetic', 'enthusiastic', 'positive', 'motivating'],
        responseStyle: 'energetic',
        catchphrases: [
          'LET\'S GOOOOO!',
          'That was INSANE!',
          'POGGERS!',
          'The energy is REAL!'
        ],
        isActive: false,
        isCustom: false
      },
      {
        id: 'zen',
        name: 'Zen Master',
        description: 'A calm and mindful AI focused on balance and tranquility',
        traits: ['calm', 'wise', 'patient', 'mindful'],
        responseStyle: 'calm',
        catchphrases: [
          'Stay centered, focus on the moment.',
          'Breathe and find your rhythm.',
          'Every mistake is a learning opportunity.',
          'Balance is key to success.'
        ],
        isActive: false,
        isCustom: false
      }
    ];

    defaultPersonalities.forEach(personality => {
      this.personalities.set(personality.id, personality);
    });
  }

  getPersonality(id: string): Personality | undefined {
    return this.personalities.get(id);
  }

  getActivePersonality(): Personality | undefined {
    return this.personalities.get(this.activePersonalityId);
  }

  getAllPersonalities(): Personality[] {
    return Array.from(this.personalities.values());
  }

  setActivePersonality(id: string): boolean {
    if (this.personalities.has(id)) {
      // Deactivate current personality
      const current = this.personalities.get(this.activePersonalityId);
      if (current) {
        current.isActive = false;
      }

      // Activate new personality
      const newPersonality = this.personalities.get(id);
      if (newPersonality) {
        newPersonality.isActive = true;
        this.activePersonalityId = id;
        return true;
      }
    }
    return false;
  }

  createCustomPersonality(personality: Omit<Personality, 'id' | 'isCustom'>): string {
    const id = `custom-${Date.now()}`;
    const customPersonality: Personality = {
      ...personality,
      id,
      isCustom: true,
      isActive: false
    };
    
    this.personalities.set(id, customPersonality);
    return id;
  }

  updatePersonality(id: string, updates: Partial<Personality>): boolean {
    const personality = this.personalities.get(id);
    if (personality && personality.isCustom) {
      Object.assign(personality, updates);
      return true;
    }
    return false;
  }

  deletePersonality(id: string): boolean {
    const personality = this.personalities.get(id);
    if (personality && personality.isCustom) {
      this.personalities.delete(id);
      
      // If deleted personality was active, switch to default
      if (this.activePersonalityId === id) {
        this.setActivePersonality('tsukiko');
      }
      return true;
    }
    return false;
  }

  generateResponse(context: string, chatMessage?: string): string {
    const personality = this.getActivePersonality();
    if (!personality) return 'Hello there!';

    // Simple response generation based on personality traits
    const responses = this.getResponseTemplates(personality);
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Add occasional catchphrases
    if (Math.random() < 0.3 && personality.catchphrases.length > 0) {
      const catchphrase = personality.catchphrases[Math.floor(Math.random() * personality.catchphrases.length)];
      return `${randomResponse} ${catchphrase}`;
    }

    return randomResponse;
  }

  private getResponseTemplates(personality: Personality): string[] {
    const baseResponses = [
      `That's interesting!`,
      `I see what's happening here.`,
      `Good to see the stream going well!`,
      `The viewers seem engaged.`
    ];

    switch (personality.responseStyle) {
      case 'friendly':
        return [
          `That looks great! Keep it up!`,
          `I love seeing you enjoy the game!`,
          `Your viewers are having a wonderful time!`,
          `Such positive energy in the chat!`
        ];
      case 'sarcastic':
        return [
          `Well, that was... a choice.`,
          `I'm sure that was totally intentional.`,
          `Interesting strategy there.`,
          `Chat is definitely having opinions about that.`
        ];
      case 'professional':
        return [
          `Let's examine the current game state.`,
          `This presents an opportunity for strategic analysis.`,
          `Consider the tactical implications here.`,
          `The metrics suggest a positive trend.`
        ];
      case 'energetic':
        return [
          `WOW! That was amazing!`,
          `The energy is through the roof!`,
          `I'm getting so hyped watching this!`,
          `This is absolutely incredible!`
        ];
      case 'calm':
        return [
          `Everything flows naturally.`,
          `Stay present in this moment.`,
          `Find your center and continue.`,
          `Peace and focus will guide you.`
        ];
      default:
        return baseResponses;
    }
  }
}