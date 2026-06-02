import { randomUUID } from 'crypto';
import { ensureAiosDirs, getAiosPaths } from './paths';

interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

interface StatementLike {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Array<Record<string, unknown>>;
}

interface DatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): StatementLike;
  close?(): void;
}

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (filename: string) => DatabaseLike;
};

export interface StoredMessage {
  id: string;
  channel: string;
  direction: 'incoming' | 'outgoing';
  userId: string;
  senderNick?: string;
  messageType: string;
  content?: string;
  externalMessageId?: string;
  conversationId?: string;
  raw?: unknown;
  createdAt?: string;
}

export interface StoredKnowledgeItem {
  id: string;
  sourceMessageId?: string;
  sourceType: 'message' | 'file' | 'manual' | 'todo' | 'code';
  title: string;
  summary: string;
  content: string;
  tags: string[];
  project?: string;
  dueDate?: string;
  importance: 'low' | 'normal' | 'high';
  fileId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoredFileItem {
  id: string;
  sourceMessageId?: string;
  channel: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  localPath: string;
  downloadStatus: 'saved' | 'metadata_only' | 'failed';
  downloadError?: string;
  remoteId?: string;
  raw?: unknown;
  createdAt?: string;
}

export interface SearchResult {
  id: string;
  sourceType: string;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  project?: string;
  dueDate?: string;
  importance: string;
  createdAt: string;
}

let db: DatabaseLike | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

export function getDb(): DatabaseLike {
  if (db) return db;
  const paths = getAiosPaths();
  ensureAiosDirs(paths);
  db = new DatabaseSync(paths.dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      direction TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sender_nick TEXT,
      message_type TEXT NOT NULL,
      content TEXT,
      external_message_id TEXT,
      conversation_id TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user_created
      ON messages(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      source_message_id TEXT,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      project TEXT,
      due_date TEXT,
      importance TEXT NOT NULL,
      file_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_created
      ON knowledge_items(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_knowledge_source_message
      ON knowledge_items(source_message_id);

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      source_message_id TEXT,
      channel TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      local_path TEXT NOT NULL,
      download_status TEXT NOT NULL,
      download_error TEXT,
      remote_id TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_files_created
      ON files(created_at DESC);
  `);
  return db;
}

export function _resetDbForTesting(): void {
  db?.close?.();
  db = null;
}

export function recordMessage(input: Omit<StoredMessage, 'id'> & { id?: string }): StoredMessage {
  const database = getDb();
  const item: StoredMessage = {
    id: input.id ?? randomUUID(),
    channel: input.channel,
    direction: input.direction,
    userId: input.userId,
    senderNick: input.senderNick,
    messageType: input.messageType,
    content: input.content,
    externalMessageId: input.externalMessageId,
    conversationId: input.conversationId,
    raw: input.raw,
    createdAt: input.createdAt ?? nowIso(),
  };

  database.prepare(`
    INSERT OR REPLACE INTO messages (
      id, channel, direction, user_id, sender_nick, message_type, content,
      external_message_id, conversation_id, raw_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.channel,
    item.direction,
    item.userId,
    item.senderNick ?? null,
    item.messageType,
    item.content ?? null,
    item.externalMessageId ?? null,
    item.conversationId ?? null,
    json(item.raw),
    item.createdAt
  );

  return item;
}

export function createKnowledgeItem(
  input: Omit<StoredKnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): StoredKnowledgeItem {
  const database = getDb();
  const createdAt = input.createdAt ?? nowIso();
  const item: StoredKnowledgeItem = {
    id: input.id ?? randomUUID(),
    sourceMessageId: input.sourceMessageId,
    sourceType: input.sourceType,
    title: input.title,
    summary: input.summary,
    content: input.content,
    tags: input.tags,
    project: input.project,
    dueDate: input.dueDate,
    importance: input.importance,
    fileId: input.fileId,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };

  database.prepare(`
    INSERT OR REPLACE INTO knowledge_items (
      id, source_message_id, source_type, title, summary, content, tags_json,
      project, due_date, importance, file_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.sourceMessageId ?? null,
    item.sourceType,
    item.title,
    item.summary,
    item.content,
    json(item.tags),
    item.project ?? null,
    item.dueDate ?? null,
    item.importance,
    item.fileId ?? null,
    item.createdAt,
    item.updatedAt
  );

  return item;
}

export function recordFileItem(input: Omit<StoredFileItem, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
}): StoredFileItem {
  const database = getDb();
  const item: StoredFileItem = {
    id: input.id ?? randomUUID(),
    sourceMessageId: input.sourceMessageId,
    channel: input.channel,
    originalName: input.originalName,
    mimeType: input.mimeType,
    size: input.size,
    localPath: input.localPath,
    downloadStatus: input.downloadStatus,
    downloadError: input.downloadError,
    remoteId: input.remoteId,
    raw: input.raw,
    createdAt: input.createdAt ?? nowIso(),
  };

  database.prepare(`
    INSERT OR REPLACE INTO files (
      id, source_message_id, channel, original_name, mime_type, size,
      local_path, download_status, download_error, remote_id, raw_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.sourceMessageId ?? null,
    item.channel,
    item.originalName,
    item.mimeType ?? null,
    item.size ?? null,
    item.localPath,
    item.downloadStatus,
    item.downloadError ?? null,
    item.remoteId ?? null,
    json(item.raw),
    item.createdAt
  );

  return item;
}

export function searchKnowledge(query: string, limit = 8): SearchResult[] {
  const database = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 30);
  const like = `%${query.trim()}%`;
  const rows = database.prepare(`
    SELECT id, source_type, title, summary, content, tags_json, project,
           due_date, importance, created_at
    FROM knowledge_items
    WHERE title LIKE ? OR summary LIKE ? OR content LIKE ? OR tags_json LIKE ? OR project LIKE ?
    ORDER BY
      CASE
        WHEN title LIKE ? THEN 0
        WHEN tags_json LIKE ? THEN 1
        WHEN summary LIKE ? THEN 2
        ELSE 3
      END,
      created_at DESC
    LIMIT ?
  `).all(like, like, like, like, like, like, like, like, safeLimit);

  return rows.map(row => ({
    id: String(row.id),
    sourceType: String(row.source_type),
    title: String(row.title),
    summary: String(row.summary),
    content: String(row.content),
    tags: parseTags(row.tags_json),
    project: typeof row.project === 'string' ? row.project : undefined,
    dueDate: typeof row.due_date === 'string' ? row.due_date : undefined,
    importance: String(row.importance),
    createdAt: String(row.created_at),
  }));
}

export function getRecentFiles(limit = 8): StoredFileItem[] {
  const database = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 30);
  const rows = database.prepare(`
    SELECT id, source_message_id, channel, original_name, mime_type, size,
           local_path, download_status, download_error, remote_id, raw_json, created_at
    FROM files
    ORDER BY created_at DESC
    LIMIT ?
  `).all(safeLimit);

  return rows.map(row => ({
    id: String(row.id),
    sourceMessageId: typeof row.source_message_id === 'string' ? row.source_message_id : undefined,
    channel: String(row.channel),
    originalName: String(row.original_name),
    mimeType: typeof row.mime_type === 'string' ? row.mime_type : undefined,
    size: typeof row.size === 'number' ? row.size : undefined,
    localPath: String(row.local_path),
    downloadStatus: row.download_status as StoredFileItem['downloadStatus'],
    downloadError: typeof row.download_error === 'string' ? row.download_error : undefined,
    remoteId: typeof row.remote_id === 'string' ? row.remote_id : undefined,
    raw: row.raw_json,
    createdAt: String(row.created_at),
  }));
}
