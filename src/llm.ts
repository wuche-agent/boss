import OpenAI from 'openai';
import { ConversationTurn, PendingTask } from './conversation';
import { STRATEGIC_ADVISOR_PROMPT } from './prompts/system';

const client = new OpenAI({
  baseURL: process.env.HERMES_BASE_URL ?? 'http://localhost:11434/v1',
  apiKey: process.env.HERMES_API_KEY ?? 'ollama',
});

const MODEL = process.env.HERMES_MODEL ?? 'qwen3.6-plus';

export interface ConversationResult {
  reply: string;
  task?: PendingTask;
}

export async function conductConversation(
  history: ConversationTurn[]
): Promise<ConversationResult> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: STRATEGIC_ADVISOR_PROMPT },
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
        `内容：${task.detail}\n\n` +
        `回复"确认"完成创建，或继续补充调整。`;
      return { reply: confirmText, task };
    } catch {
      // JSON parse failed — treat as normal reply
    }
  }

  return { reply: content };
}
