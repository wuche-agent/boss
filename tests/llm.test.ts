import { generateTaskSummary } from '../src/llm';

// Mock openai
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '任务摘要：小王需要在5月20日前完成季度报告' } }],
        }),
      },
    },
  }));
});

describe('llm', () => {
  it('generates a task summary from session data', async () => {
    const summary = await generateTaskSummary({
      step: 'awaiting_confirm',
      raw_intent: '让小王做个报告',
      assignee_name: '小王',
      deadline: '2026-05-20',
      detail: '完成Q2季度销售报告',
    } as any);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });
});
