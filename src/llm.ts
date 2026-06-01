import { spawn } from 'child_process';
import * as path from 'path';
import OpenAI from 'openai';
import { ConversationTurn, PendingTask } from './conversation';
import { buildSystemPrompt } from './prompts/system';
import type { InboxItem } from './inbox';

const HERMES_PORTS = [8641, 8642];
const PROJECT_ROOT = path.resolve(__dirname, '..');

let client: OpenAI = new OpenAI({
  baseURL: process.env.HERMES_BASE_URL ?? 'http://localhost:11434/v1',
  apiKey: process.env.HERMES_API_KEY ?? 'ollama',
});
const MODEL = process.env.HERMES_MODEL ?? 'qwen3.6-plus';

async function detectLocalHermes(): Promise<string | null> {
  for (const port of HERMES_PORTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`http://localhost:${port}/v1/models`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return `http://localhost:${port}/v1`;
    } catch {
      // port not responding, try next
    }
  }
  return null;
}

export async function initLLM(): Promise<void> {
  let baseUrl = await detectLocalHermes();

  if (baseUrl) {
    console.log(`[llm] Using local Hermes at ${baseUrl}`);
  } else {
    const envUrl = process.env.HERMES_BASE_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      console.log(`[llm] No local Hermes found. Falling back to remote API: ${envUrl}`);
      baseUrl = envUrl;
    } else {
      console.log('[llm] No local Hermes service found. Attempting to start via start.sh...');
      const startScript = path.join(PROJECT_ROOT, 'scripts', 'start.sh');
      const proc = spawn('bash', [startScript], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, PATH: process.env.PATH ?? '' },
      });
      proc.unref();

      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        baseUrl = await detectLocalHermes();
        if (baseUrl) break;
      }

      if (!baseUrl) {
        throw new Error(
          '[llm] 本地 Hermes 服务启动失败，请手动运行 ./scripts/start.sh 后重试。'
        );
      }
      console.log(`[llm] Local Hermes started at ${baseUrl}`);
    }
  }

  client = new OpenAI({
    baseURL: baseUrl,
    apiKey: process.env.HERMES_API_KEY ?? 'ollama',
  });
}

export interface ConversationResult {
  reply: string;
  task?: PendingTask;
}

export interface InboxClassification {
  kind: 'todo' | 'note' | 'idea' | 'question' | 'link' | 'file' | 'other';
  title: string;
  summary: string;
  tags: string[];
  project?: string;
  due_date?: string;
  importance: 'low' | 'normal' | 'high';
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function optionalStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function inferInboxKind(text: string): InboxClassification['kind'] {
  if (/https?:\/\//i.test(text)) return 'link';
  if (/[?？]$/.test(text) || /^(为什么|怎么|如何|能否|是否|查询|问)/.test(text)) return 'question';
  if (/(提醒|待办|明天|后天|下周|截止|todo|要做)/i.test(text)) return 'todo';
  if (/(想法|灵感|idea|可以试试|也许)/i.test(text)) return 'idea';
  return 'note';
}

export function fallbackInboxClassification(text: string): InboxClassification {
  const compact = text.replace(/\s+/g, ' ').trim();
  return {
    kind: inferInboxKind(compact),
    title: compact.slice(0, 28) || '未命名记录',
    summary: compact.slice(0, 120) || '空记录',
    tags: [],
    importance: /紧急|重要|马上|今天|deadline|asap/i.test(compact) ? 'high' : 'normal',
  };
}

function normalizeInboxClassification(
  raw: Record<string, unknown> | null,
  text: string
): InboxClassification {
  if (!raw) return fallbackInboxClassification(text);

  const fallback = fallbackInboxClassification(text);
  const allowedKinds: InboxClassification['kind'][] = [
    'todo',
    'note',
    'idea',
    'question',
    'link',
    'file',
    'other',
  ];
  const allowedImportance: InboxClassification['importance'][] = ['low', 'normal', 'high'];
  const kind = allowedKinds.includes(raw.kind as InboxClassification['kind'])
    ? (raw.kind as InboxClassification['kind'])
    : fallback.kind;
  const importance = allowedImportance.includes(raw.importance as InboxClassification['importance'])
    ? (raw.importance as InboxClassification['importance'])
    : fallback.importance;
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()))
        .map(tag => tag.trim())
        .slice(0, 6)
    : fallback.tags;

  return {
    kind,
    title: stringField(raw.title, fallback.title).slice(0, 40),
    summary: stringField(raw.summary, fallback.summary).slice(0, 240),
    tags,
    project: optionalStringField(raw.project),
    due_date: optionalStringField(raw.due_date),
    importance,
  };
}

export async function conductConversation(
  history: ConversationTurn[]
): Promise<ConversationResult> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(today) },
      ...history,
    ],
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content ?? '';
  const marker = '<<<TASK_READY>>>';

  if (content.includes(marker)) {
    const [prose, jsonPart] = content.split(marker);
    try {
      const task = JSON.parse(jsonPart.trim()) as PendingTask;
      const confirmText =
        (prose.trim() ? prose.trim() + '\n\n' : '') +
        `---\n` +
        `📋 任务方案\n` +
        `目标：${task.goal}\n` +
        `负责人：${task.assignee_name}\n` +
        `截止：${task.deadline}\n` +
        `内容：${task.detail}\n` +
        (task.notes ? `备注：${task.notes}\n` : '') +
        `\n回复"确认"完成创建，或继续补充调整。`;
      return { reply: confirmText, task };
    } catch {
      // JSON parse failed — treat as normal reply
    }
  }

  return { reply: content };
}

export async function classifyInboxText(text: string): Promise<InboxClassification> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          `你是个人 AI 收件箱的分类器。今天是 ${today}。\n` +
          `把用户随手发来的中文内容整理成一个 JSON 对象，不要输出 Markdown。\n` +
          `字段：kind(todo|note|idea|question|link|file|other), title, summary, tags, project, due_date, importance(low|normal|high)。\n` +
          `如果没有项目或日期，省略 project 或 due_date。due_date 必须用 YYYY-MM-DD。tags 最多 6 个。`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content ?? '';
  return normalizeInboxClassification(extractJsonObject(content), text);
}

export async function answerInboxQuestion(question: string, items: InboxItem[]): Promise<string> {
  if (items.length === 0) {
    return '我还没有可检索的记录。你可以先把想法、链接、待办直接发给我，我会帮你存进收件箱。';
  }

  const context = items
    .map((item, index) => {
      const tags = item.tags.length ? ` #${item.tags.join(' #')}` : '';
      return [
        `${index + 1}. [${item.createdAt.slice(0, 10)}][${item.kind}] ${item.title}${tags}`,
        `摘要：${item.summary}`,
        `原文：${item.content}`,
      ].join('\n');
    })
    .join('\n\n');

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          '你是个人 AI 系统的记忆检索助手。只根据给定收件箱记录回答，缺少依据就明确说明。回答要中文、简洁、可执行。',
      },
      { role: 'user', content: `问题：${question}\n\n收件箱记录：\n${context}` },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() || '我没有从现有记录里找到明确答案。';
}
