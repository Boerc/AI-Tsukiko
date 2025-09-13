import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import { metrics } from '../metrics/metrics.js';

export class MemoryLifecycle {
  private db: Database.Database;
  private dataDir: string;
  private retentionDays: number;
  constructor(db: Database.Database, dataDir: string, retentionDays = 30) {
    this.db = db;
    this.dataDir = dataDir;
    this.retentionDays = retentionDays;
  }

  schedule() {
    // Daily retention at 04:00
    cron.schedule('0 4 * * *', () => this.pruneOldMessages().catch(() => {}));
    // Daily backup at 04:15
    cron.schedule('15 4 * * *', () => this.backup().catch(() => {}));
    // Weekly vacuum on Sunday at 04:30
    cron.schedule('30 4 * * 0', () => this.vacuum().catch(() => {}));
  }

  async pruneOldMessages(): Promise<void> {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const stmt = this.db.prepare('DELETE FROM messages WHERE created_at < ?');
    const before = (this.db.prepare('SELECT COUNT(*) as c FROM messages').get() as any).c as number;
    const info = stmt.run(cutoff);
    const after = (this.db.prepare('SELECT COUNT(*) as c FROM messages').get() as any).c as number;
    const pruned = before - after;
    metrics.counters.memory_pruned_total.inc({}, pruned);
  }

  async backup(): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const src = (this.db as any).name || path.join(this.dataDir, 'tsukiko.db');
    const dstDir = path.join(this.dataDir, 'backups');
    const dst = path.join(dstDir, `tsukiko-${stamp}.db`);
    fs.mkdirSync(dstDir, { recursive: true });
    fs.copyFileSync(src, dst);
    metrics.counters.backups_total.inc({});
  }

  async vacuum(): Promise<void> {
    this.db.exec('VACUUM');
  }
}

