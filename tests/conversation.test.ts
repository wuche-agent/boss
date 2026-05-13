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
      step: 'awaiting_assignee',
      raw_intent: '让小王做个报告',
    };
    await setSession('user_1', session);
    const retrieved = await getSession('user_1');
    expect(retrieved).toEqual(session);
  });

  it('clears a session', async () => {
    await setSession('user_2', { step: 'done', raw_intent: 'test' });
    await clearSession('user_2');
    const session = await getSession('user_2');
    expect(session).toBeNull();
  });
});
