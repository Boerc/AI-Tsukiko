import Database from 'better-sqlite3';

export type Highlight = { id: string; timestamp: number; reason: string };

export class HighlightStore {
  private db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS highlights (
        id TEXT PRIMARY KEY,
        ts INTEGER NOT NULL,
        reason TEXT NOT NULL
      );
    `);
  }
  add(id: string, ts: number, reason: string) {
    this.db.prepare('INSERT INTO highlights (id, ts, reason) VALUES (?, ?, ?)').run(id, ts, reason);
  }
  list(limit = 50): Highlight[] {
    const rows = this.db.prepare('SELECT id, ts as timestamp, reason FROM highlights ORDER BY ts DESC LIMIT ?').all(limit) as any[];
    return rows;
  }
}

export class HighlightDetector {
  private lastCounts: number[] = [];
  private window = 30; // seconds
  private threshold = 2.5; // multiple of median
  recordChatCount(count: number): boolean {
    this.lastCounts.push(count);
    if (this.lastCounts.length > this.window) this.lastCounts.shift();
    if (this.lastCounts.length < this.window) return false;
    const sorted = [...this.lastCounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1;
    return count > median * this.threshold;
  }
}

