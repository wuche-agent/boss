import { spawn } from 'child_process';
import * as path from 'path';
import OpenAI from 'openai';
import { ConversationTurn, PendingTask } from './conversation';
import { buildSystemPrompt } from './prompts/system';

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
