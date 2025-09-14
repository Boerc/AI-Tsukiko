import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export type ChatMessage = { id: string; userId: string | null; role: 'user' | 'assistant' | 'system'; content: string; createdAt: number };

export class MemoryStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  upsertUser(platform: string, externalId: string, displayName?: string, avatarUrl?: string): string {
    const now = Date.now();
    const row = this.db.prepare('SELECT id FROM users WHERE platform=? AND external_id=?').get(platform, externalId) as { id?: string } | undefined;
    if (row?.id) {
      if (displayName || avatarUrl) {
        this.db.prepare('UPDATE users SET display_name=COALESCE(?, display_name), avatar_url=COALESCE(?, avatar_url) WHERE id=?').run(displayName ?? null, avatarUrl ?? null, row.id);
      }
      return row.id;
    }
    const id = randomUUID();
    this.db.prepare('INSERT INTO users (id, platform, external_id, display_name, avatar_url, created_at) VALUES (?,?,?,?,?,?)')
      .run(id, platform, externalId, displayName ?? null, avatarUrl ?? null, now);
    return id;
  }

  getUserById(userId: string): { id: string; platform: string; external_id: string; display_name: string | null } | null {
    const row = this.db.prepare('SELECT id, platform, external_id, display_name FROM users WHERE id=?').get(userId) as any;
    return row ?? null;
  }

  saveMessage(message: Omit<ChatMessage, 'id' | 'createdAt'> & { createdAt?: number }): ChatMessage {
    const id = randomUUID();
    const createdAt = message.createdAt ?? Date.now();
    this.db.prepare('INSERT INTO messages (id, user_id, role, content, created_at) VALUES (?,?,?,?,?)')
      .run(id, message.userId ?? null, message.role, message.content, createdAt);
    return { id, userId: message.userId ?? null, role: message.role, content: message.content, createdAt };
  }

  getRecentMessages(userId: string | null, limit = 50): ChatMessage[] {
    const rows = userId
      ? this.db.prepare('SELECT id, user_id as userId, role, content, created_at as createdAt FROM messages WHERE user_id=? ORDER BY created_at DESC LIMIT ?').all(userId, limit) as any[]
      : this.db.prepare('SELECT id, user_id as userId, role, content, created_at as createdAt FROM messages ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.reverse();
  }

  setMemory(key: string, value: string, scope: 'global' | 'personal' = 'global', userId?: string): void {
    const now = Date.now();
    if (scope === 'personal' && !userId) throw new Error('userId required for personal memory');
    this.db.prepare(`INSERT INTO memories (id, user_id, key, value, scope, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(key, scope, user_id)
                     DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(randomUUID(), userId ?? null, key, value, scope, now);
  }

  getMemory(key: string, scope: 'global' | 'personal' = 'global', userId?: string): string | null {
    const row = this.db.prepare('SELECT value FROM memories WHERE key=? AND scope=? AND user_id IS ?')
      .get(key, scope, scope === 'personal' ? userId ?? null : null) as { value?: string } | undefined;
    return row?.value ?? null;
  }

  getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  setSetting(key: string, value: string): void {
    const now = Date.now();
    this.db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
      .run(key, value, now);
  }

  deleteSetting(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key=?').run(key);
  }
}

