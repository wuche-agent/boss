import { mkdirSync } from 'fs';
import * as path from 'path';
import { getAiosPaths, sanitizePathPart } from './paths';
import {
  SearchResult,
  StoredFileItem,
  StoredKnowledgeItem,
  createKnowledgeItem,
  getRecentFiles,
  recordFileItem,
  recordMessage,
  searchKnowledge,
} from './store';
import type { InboxClassification } from '../llm';

export interface IncomingMessageRecord {
  channel: 'dingtalk' | 'feishu';
  userId: string;
  senderNick?: string;
  messageType: string;
  content?: string;
  externalMessageId?: string;
  conversationId?: string;
  raw?: unknown;
}

export interface FileMetadataInput {
  id?: string;
  sourceMessageId?: string;
  channel: 'dingtalk' | 'feishu';
  originalName: string;
  mimeType?: string;
  size?: number;
  remoteId?: string;
  raw?: unknown;
  downloadStatus?: StoredFileItem['downloadStatus'];
  downloadError?: string;
}

export function recordIncomingMessage(input: IncomingMessageRecord) {
  return recordMessage({
    channel: input.channel,
    direction: 'incoming',
    userId: input.userId,
    senderNick: input.senderNick,
    messageType: input.messageType,
    content: input.content,
    externalMessageId: input.externalMessageId,
    conversationId: input.conversationId,
    raw: input.raw,
  });
}

export function recordAssistantReply(userId: string, content: string, raw?: unknown) {
  return recordMessage({
    channel: 'dingtalk',
    direction: 'outgoing',
    userId,
    senderNick: 'AI Assistant',
    messageType: 'text',
    content,
    raw,
  });
}

export function createKnowledgeFromClassification(params: {
  sourceMessageId?: string;
  content: string;
  classification: InboxClassification;
  sourceType?: StoredKnowledgeItem['sourceType'];
}): StoredKnowledgeItem {
  return createKnowledgeItem({
    sourceMessageId: params.sourceMessageId,
    sourceType: params.sourceType ?? 'message',
    title: params.classification.title,
    summary: params.classification.summary,
    content: params.content,
    tags: params.classification.tags,
    project: params.classification.project,
    dueDate: params.classification.due_date,
    importance: params.classification.importance,
  });
}

export function saveManualKnowledge(params: {
  sourceMessageId?: string;
  content: string;
  title?: string;
  sourceType?: StoredKnowledgeItem['sourceType'];
}): StoredKnowledgeItem {
  const compact = params.content.replace(/\s+/g, ' ').trim();
  return createKnowledgeItem({
    sourceMessageId: params.sourceMessageId,
    sourceType: params.sourceType ?? 'manual',
    title: params.title || compact.slice(0, 40) || '手动保存',
    summary: compact.slice(0, 180) || '手动保存',
    content: params.content,
    tags: [],
    importance: 'normal',
  });
}

export function registerFileMetadata(input: FileMetadataInput): StoredFileItem {
  const paths = getAiosPaths();
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(paths.filesDir, day);
  mkdirSync(dir, { recursive: true });
  const fileName = sanitizePathPart(input.originalName);
  const localPath = path.join(dir, fileName);

  return recordFileItem({
    id: input.id,
    sourceMessageId: input.sourceMessageId,
    channel: input.channel,
    originalName: input.originalName,
    mimeType: input.mimeType,
    size: input.size,
    localPath,
    downloadStatus: input.downloadStatus ?? 'metadata_only',
    downloadError: input.downloadError,
    remoteId: input.remoteId,
    raw: input.raw,
  });
}

export function formatSearchResults(results: SearchResult[], query: string): string {
  if (results.length === 0) return `没有在本地知识库里找到：${query}`;
  const lines = results.map((item, index) => {
    const tags = item.tags.length ? ` ${item.tags.map(tag => `#${tag}`).join(' ')}` : '';
    const due = item.dueDate ? ` 截止:${item.dueDate}` : '';
    return `${index + 1}. [${item.createdAt.slice(0, 10)}][${item.sourceType}] ${item.title}${tags}${due}\n   ${item.summary}`;
  });
  return `本地知识库搜索：${query}\n${lines.join('\n')}`;
}

export function runKnowledgeSearch(query: string, limit = 8): SearchResult[] {
  return searchKnowledge(query, limit);
}

export function formatRecentFiles(limit = 8): string {
  const files = getRecentFiles(limit);
  if (files.length === 0) return 'Mac mini 上还没有保存过文件。你可以在钉钉里发文件给我。';
  const lines = files.map((file, index) => {
    const size = typeof file.size === 'number' ? ` ${Math.round(file.size / 1024)}KB` : '';
    const date = (file.createdAt ?? '').slice(0, 10);
    return `${index + 1}. [${date}][${file.downloadStatus}] ${file.originalName}${size}\n   ${file.localPath}`;
  });
  return `最近文件\n${lines.join('\n')}`;
}
