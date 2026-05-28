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
      '好的，任务已明确。\n<<<TASK_READY>>>{"title":"Q2客户复盘报告","assignee_name":"小王","deadline":"2026-05-20 18:00","detail":"整理Q2客户复盘报告","purpose":"为经营复盘会准备决策材料","deliverable":"一份复盘文档 + 关键问题清单","summary":"小王在5月20日18:00前提交Q2客户复盘报告","raw_intent":"让小王下周前把客户复盘整理出来"}';
    const result = await conductConversation(history);
    expect(result.task).toBeDefined();
    expect(result.task?.assignee_name).toBe('小王');
    expect(result.task?.deadline).toBe('2026-05-20 18:00');
    expect(result.task?.purpose).toBe('为经营复盘会准备决策材料');
    expect(result.task?.deliverable).toBe('一份复盘文档 + 关键问题清单');
    expect(result.reply).toContain('小王');
  });

  it('parses INSPECTION_QUERY marker and returns a structured query', async () => {
    mockContent =
      '我来查一下。\n<<<INSPECTION_QUERY>>>{"scope":"person","target":"小王","status":"进行中","timeRange":"all"}';
    const result = await conductConversation(history);
    expect(result.inspection).toEqual({
      scope: 'person',
      target: '小王',
      status: '进行中',
      timeRange: 'all',
    });
    expect(result.reply).toContain('我来查一下');
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
