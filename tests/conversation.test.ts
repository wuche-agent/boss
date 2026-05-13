import { getSession, setSession, clearSession, Session } from '../src/conversation';

// Mock ioredis
const store: Record<string, string> = {};
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => store[key] ?? null),
    set: jest.fn(async (key: string, value: string, _ex: string, _ttl: number) => {
      store[key] = value;
    }),
    del: jest.fn(async (key: string) => { delete store[key]; }),
  }));
});

describe('conversation', () => {
  beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

  it('returns null for unknown user', async () => {
    const session = await getSession('user_unknown');
    expect(session).toBeNull();
  });

  it('stores and retrieves a session', async () => {
    const session: Session = {
      step: 'clarifying',
      history: [{ role: 'user', content: '让小王做个报告' }],
    };
    await setSession('user_1', session);
    const retrieved = await getSession('user_1');
    expect(retrieved).toEqual(session);
  });

  it('stores session with pending task', async () => {
    const session: Session = {
      step: 'awaiting_confirm',
      history: [],
      pending_task: {
        goal: '提升销售效率',
        assignee_name: '小王',
        deadline: '2026-05-20',
        detail: '完成Q2季度销售报告',
        summary: '小王负责Q2销售报告，截止5月20日',
      },
    };
    await setSession('user_2', session);
    const retrieved = await getSession('user_2');
    expect(retrieved?.pending_task?.assignee_name).toBe('小王');
  });

  it('clears a session', async () => {
    await setSession('user_3', { step: 'done', history: [] });
    await clearSession('user_3');
    const session = await getSession('user_3');
    expect(session).toBeNull();
  });
});
