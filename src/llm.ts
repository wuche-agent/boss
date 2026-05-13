import OpenAI from 'openai';
import { Session } from './conversation';
import { TASK_SUMMARY_PROMPT } from './prompts/system';

const client = new OpenAI({
  baseURL: process.env.HERMES_BASE_URL ?? 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

const MODEL = process.env.HERMES_MODEL ?? 'hermes3';

export async function generateTaskSummary(session: Session): Promise<string> {
  const userMessage = `原始需求：${session.raw_intent}\n负责人：${session.assignee_name}\n截止日期：${session.deadline}\n具体任务：${session.detail}`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: TASK_SUMMARY_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? '任务已记录';
}
