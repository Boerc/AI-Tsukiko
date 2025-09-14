import { VtsController } from './vts.js';
import { MemoryStore } from '../memory/memory.js';

export type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral';

const expressionMap: Record<Emotion, { parameter: string; value: number }> = {
  happy: { parameter: 'Smile', value: 0.9 },
  sad: { parameter: 'Sad', value: 0.8 },
  angry: { parameter: 'Angry', value: 0.8 },
  surprised: { parameter: 'Surprised', value: 0.9 },
  neutral: { parameter: 'Neutral', value: 0.5 }
};

export function triggerEmotion(vts: VtsController, emotion: Emotion, mem?: MemoryStore): void {
  const customParam = mem?.getAllSettings?.()?.[`emotion.${emotion}`];
  const map = customParam ? { parameter: String(customParam), value: 0.9 } : (expressionMap[emotion] ?? expressionMap.neutral);
  vts.setExpression(map.parameter, map.value);
  setTimeout(() => vts.setExpression(map.parameter, 0.0), 1200);
}

export function quickSentimentToEmotion(text: string): Emotion {
  const l = text.toLowerCase();
  if (/\b(gg|lol|haha|awesome|nice|great|love)\b/.test(l)) return 'happy';
  if (/\b(sad|unfair|bad|cry)\b/.test(l)) return 'sad';
  if (/\b(angry|mad|wtf|rage)\b/.test(l)) return 'angry';
  if (/\b(what|omg|wow)\b/.test(l)) return 'surprised';
  return 'neutral';
}

