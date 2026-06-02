import * as fs from 'fs';
import * as path from 'path';
import { getAiosPaths } from './paths';

export interface StreamAuditRecord {
  topic?: string;
  messageId?: string;
  data?: string;
  headers?: unknown;
}

export function auditStreamEvent(record: StreamAuditRecord): void {
  try {
    const paths = getAiosPaths();
    const date = new Date().toISOString().slice(0, 10);
    const dir = path.join(paths.inboxDir, 'stream-events');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      recordedAt: new Date().toISOString(),
      ...record,
    });
    fs.appendFileSync(path.join(dir, `${date}.jsonl`), `${line}\n`);
  } catch (err) {
    console.error('[audit] failed to write stream event:', err);
  }
}

