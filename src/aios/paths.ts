import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface AiosPaths {
  root: string;
  dbDir: string;
  dbPath: string;
  inboxDir: string;
  filesDir: string;
  knowledgeDir: string;
}

export function getAiosPaths(): AiosPaths {
  const root = process.env.AIOS_ROOT || path.join(os.homedir(), 'AI-OS');
  const dbDir = path.join(root, 'db');
  return {
    root,
    dbDir,
    dbPath: path.join(dbDir, 'aios.sqlite'),
    inboxDir: path.join(root, 'inbox'),
    filesDir: path.join(root, 'files'),
    knowledgeDir: path.join(root, 'knowledge'),
  };
}

export function ensureAiosDirs(paths = getAiosPaths()): void {
  for (const dir of [paths.root, paths.dbDir, paths.inboxDir, paths.filesDir, paths.knowledgeDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function sanitizePathPart(value: string, fallback = 'untitled'): string {
  const sanitized = value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || fallback;
}

