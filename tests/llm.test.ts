import { conductConversation } from '../src/llm';
import { ConversationTurn } from '../src/conversation';

let mockContent: string | null = '请问这项工作要解决什么核心问题？';
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async () => ({
          choices: mockContent !== null ? [{ message: { content: mockContent } }] : [],
        })),
      },
    },
  }));
});

const history: ConversationTurn[] = [
  { role: 'user', content: '让小王做个报告' },
];

describe('llm', () => {
  it('returns a reply for a clarifying conversation', async () => {
    mockContent = '请问这项工作要解决什么核心问题？';
    const result = await conductConversation(history);
    expect(result.reply).toBe('请问这项工作要解决什么核心问题？');
    expect(result.task).toBeUndefined();
  });

  it('parses TASK_READY marker and returns task', async () => {
    mockContent =
      '好的，任务已明确。\n<<<TASK_READY>>>{"goal":"提升销售效率","assignee_name":"小王","deadline":"2026-05-20","detail":"完成Q2季度销售报告","summary":"小王负责Q2销售报告，截止5月20日"}';
    const result = await conductConversation(history);
    expect(result.task).toBeDefined();
    expect(result.task?.assignee_name).toBe('小王');
    expect(result.task?.deadline).toBe('2026-05-20');
    expect(result.reply).toContain('小王');
  });

  it('treats malformed TASK_READY JSON as normal reply', async () => {
    mockContent = '好的。\n<<<TASK_READY>>>not-valid-json';
    const result = await conductConversation(history);
    expect(result.task).toBeUndefined();
    expect(result.reply).toContain('好的');
  });

  it('returns empty reply when LLM response is empty', async () => {
    mockContent = null;
    const result = await conductConversation(history);
    expect(result.reply).toBe('');
    expect(result.task).toBeUndefined();
  });
});
