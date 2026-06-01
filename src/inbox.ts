import { randomUUID } from 'crypto';
import { redis } from './redis';
import { classifyInboxText, fallbackInboxClassification } from './llm';
import type { InboxClassification } from './llm';

export interface InboxItem extends InboxClassification {
  id: string;
  userId: string;
  content: string;
  source: 'dingtalk';
  senderNick?: string;
  createdAt: string;
  createdAtMs: number;
}

export interface InboxMeta {
  senderNick?: string;
}

const DEFAULT_TTL_DAYS = 180;

function inboxTtlSeconds(): number {
  const raw = Number(process.env.INBOX_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  const days = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_DAYS;
  return days * 24 * 60 * 60;
}

function inboxIndexKey(userId: string): string {
  return `inbox:index:${userId}`;
}

function inboxItemKey(userId: string, id: string): string {
  return `inbox:item:${userId}:${id}`;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function captureInboxItem(
  userId: string,
  content: string,
  meta: InboxMeta = {}
): Promise<InboxItem> {
  let classification: InboxClassification;
  try {
    classification = await classifyInboxText(content);
  } catch (err) {
    console.error('[inbox] classify failed, using fallback:', err);
    classification = fallbackInboxClassification(content);
  }

  const now = new Date();
  const item: InboxItem = {
    ...classification,
    id: randomUUID(),
    userId,
    content,
    source: 'dingtalk',
    senderNick: meta.senderNick,
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
  };

  const ttl = inboxTtlSeconds();
  await redis.set(inboxItemKey(userId, item.id), JSON.stringify(item), 'EX', ttl);
  await redis.zadd(inboxIndexKey(userId), item.createdAtMs, item.id);
  await redis.expire(inboxIndexKey(userId), ttl);
  return item;
}

export async function getRecentInboxItems(userId: string, limit = 8): Promise<InboxItem[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const ids = await redis.zrevrange(inboxIndexKey(userId), 0, safeLimit - 1);
  const rawItems = await Promise.all(ids.map(id => redis.get(inboxItemKey(userId, id))));
  return rawItems
    .filter((raw): raw is string => Boolean(raw))
    .map(raw => JSON.parse(raw) as InboxItem)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function getTodayInboxItems(userId: string): Promise<InboxItem[]> {
  const today = toLocalDateKey(new Date());
  const items = await getRecentInboxItems(userId, 50);
  return items.filter(item => toLocalDateKey(new Date(item.createdAtMs)) === today);
}

function kindLabel(kind: InboxItem['kind']): string {
  const labels: Record<InboxItem['kind'], string> = {
    todo: '待办',
    note: '笔记',
    idea: '想法',
    question: '问题',
    link: '链接',
    file: '文件',
    other: '其他',
  };
  return labels[kind];
}

export function formatInboxSavedReply(item: InboxItem): string {
  const tags = item.tags.length ? `\n标签：${item.tags.map(tag => `#${tag}`).join(' ')}` : '';
  const dueDate = item.due_date ? `\n日期：${item.due_date}` : '';
  const project = item.project ? `\n项目：${item.project}` : '';
  return `已收进 AI 收件箱。\n类型：${kindLabel(item.kind)}\n标题：${item.title}\n摘要：${item.summary}${project}${dueDate}${tags}`;
}

export function formatInboxList(items: InboxItem[], title = '最近记录'): string {
  if (items.length === 0) return '收件箱里还没有记录。直接把想法、链接、待办发给我就行。';

  const lines = items.map((item, index) => {
    const date = item.createdAt.slice(0, 10);
    const tags = item.tags.length ? ` ${item.tags.map(tag => `#${tag}`).join(' ')}` : '';
    return `${index + 1}. [${date}][${kindLabel(item.kind)}] ${item.title}${tags}\n   ${item.summary}`;
  });

  return `${title}\n${lines.join('\n')}`;
}

export function buildHelpText(): string {
  return [
    '个人 AI 系统已在线。你可以这样用：',
    '',
    '直接发内容：存进 AI 收件箱并自动分类',
    '/ask 问题：基于最近记录检索回答',
    '/recent 10：查看最近 10 条记录',
    '/today：查看今日摘要',
    '/task 交办内容：进入钉钉任务交办流程',
    '取消：退出当前任务确认或澄清流程',
  ].join('\n');
}
