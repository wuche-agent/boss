import {
  captureInboxItem,
  formatInboxList,
  formatInboxSavedReply,
  getRecentInboxItems,
} from '../src/inbox';
import * as llm from '../src/llm';

const store: Record<string, string> = {};
const sortedSets: Record<string, Array<{ score: number; member: string }>> = {};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => store[key] ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    zadd: jest.fn(async (key: string, score: number, member: string) => {
      sortedSets[key] = sortedSets[key] ?? [];
      sortedSets[key] = sortedSets[key].filter(item => item.member !== member);
      sortedSets[key].push({ score, member });
    }),
    zrevrange: jest.fn(async (key: string, start: number, stop: number) => {
      return (sortedSets[key] ?? [])
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(start, stop + 1)
        .map(item => item.member);
    }),
    expire: jest.fn(async () => 1),
  }));
});

jest.mock('../src/llm', () => ({
  classifyInboxText: jest.fn(),
  fallbackInboxClassification: jest.fn((text: string) => ({
    kind: 'note',
    title: text.slice(0, 28),
    summary: text,
    tags: [],
    importance: 'normal',
  })),
}));

const mockedLlm = llm as jest.Mocked<typeof llm>;

describe('inbox', () => {
  beforeEach(() => {
    Object.keys(store).forEach(key => delete store[key]);
    Object.keys(sortedSets).forEach(key => delete sortedSets[key]);
    jest.clearAllMocks();
    mockedLlm.classifyInboxText.mockResolvedValue({
      kind: 'todo',
      title: '跟进客户',
      summary: '下周重点跟进 A 客户',
      tags: ['客户', '销售'],
      due_date: '2026-06-08',
      importance: 'high',
    });
  });

  it('captures a DingTalk message into the inbox', async () => {
    const item = await captureInboxItem('user_1', '下周重点跟进 A 客户', { senderNick: '吴车' });

    expect(item.title).toBe('跟进客户');
    expect(item.senderNick).toBe('吴车');
    expect(Object.keys(store).some(key => key.startsWith('inbox:item:user_1:'))).toBe(true);
    expect(sortedSets['inbox:index:user_1']).toHaveLength(1);
  });

  it('falls back when LLM classification fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mockedLlm.classifyInboxText.mockRejectedValue(new Error('offline'));
      const item = await captureInboxItem('user_1', '先记录这个想法');

      expect(item.kind).toBe('note');
      expect(item.title).toBe('先记录这个想法');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns recent inbox items newest first', async () => {
    const first = await captureInboxItem('user_1', '第一条');
    await new Promise(resolve => setTimeout(resolve, 2));
    const second = await captureInboxItem('user_1', '第二条');

    const items = await getRecentInboxItems('user_1', 2);
    expect(items.map(item => item.id)).toEqual([second.id, first.id]);
  });

  it('formats saved and list replies', async () => {
    const item = await captureInboxItem('user_1', '下周重点跟进 A 客户');

    expect(formatInboxSavedReply(item)).toContain('已收进 AI 收件箱');
    expect(formatInboxList([item])).toContain('[待办] 跟进客户');
  });
});
