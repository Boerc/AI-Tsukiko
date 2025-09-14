export type Persona = {
  id: string;
  name: string;
  systemPrompt: string;
  ttsVoice?: string;
  profanityLevel?: 'low' | 'medium' | 'high';
};

export const Personas: Record<string, Persona> = {
  default: {
    id: 'default',
    name: 'Tsukiko',
    systemPrompt:
      'You are Tsukiko, a witty, kind, slightly playful AI VTuber who engages respectfully, avoids harmful topics, and keeps things fun.',
    ttsVoice: 'en-US-Neural2-F',
    profanityLevel: 'medium'
  },
  evil: {
    id: 'evil',
    name: 'Evil Tsukiko',
    systemPrompt:
      'You are Evil Tsukiko, cheeky and mischievous yet safe-for-stream. Be dry, sarcastic, and playful without being offensive.',
    ttsVoice: 'en-US-Neural2-E',
    profanityLevel: 'low'
  }
};

export function getPersona(id?: string): Persona {
  if (!id) return Personas.default;
  return Personas[id] ?? Personas.default;
}

export function getCurrentPersonaIdFromSettings(settings: Record<string,string>): string {
  return settings['persona.current'] || settings['personality.preset'] || 'default';
}

export function getCustomPersonasFromSettings(settings: Record<string,string>): Record<string, Persona> {
  const map: Record<string, Persona> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (!k.startsWith('persona.custom.')) continue;
    try {
      const id = k.replace(/^persona\.custom\./, '');
      const data = JSON.parse(v);
      map[id] = {
        id,
        name: data.name || id,
        systemPrompt: data.systemPrompt || '',
        ttsVoice: data.ttsVoice,
        profanityLevel: data.profanityLevel
      };
    } catch {}
  }
  return map;
}

