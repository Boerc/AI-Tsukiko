import { MemoryStore } from './memory.js';
import { GoogleAI } from '../integrations/google.js';
import { metrics } from '../metrics/metrics.js';

export class Summarizer {
  private memory: MemoryStore;
  private google: GoogleAI;
  constructor(memory: MemoryStore, google: GoogleAI) {
    this.memory = memory;
    this.google = google;
  }

  async summarizeUser(userId: string): Promise<string> {
    const messages = this.memory.getRecentMessages(userId, 100);
    const content = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `Summarize the following user's conversation history into 6 bullet points: keep it concise, safe-for-stream, and actionable.\n\n${content}`;
    const text = await this.google.chat(prompt);
    this.memory.setMemory('summary', text, 'personal', userId);
    metrics.counters.summaries_total.inc({});
    return text;
  }
}

