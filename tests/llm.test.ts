import { generateTaskSummary } from '../src/llm';
import { Session } from '../src/conversation';

// Mock openai
let mockContent: string | null = '任务摘要：小王需要在5月20日前完成季度报告';
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

const baseSession: Session = {
  step: 'awaiting_confirm',
  raw_intent: '让小王做个报告',
  assignee_name: '小王',
  deadline: '2026-05-20',
  detail: '完成Q2季度销售报告',
};

describe('llm', () => {
  it('generates a task summary from session data', async () => {
    mockContent = '任务摘要：小王需要在5月20日前完成季度报告';
    const summary = await generateTaskSummary(baseSession);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('returns fallback string when LLM response is empty', async () => {
    mockContent = null;
    const summary = await generateTaskSummary(baseSession);
    expect(summary).toBe('任务已记录');
  });
});
