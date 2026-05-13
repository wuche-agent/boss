import { executeTask } from '../src/executor';
import * as message from '../src/dingtalk/message';
import * as todo from '../src/dingtalk/todo';
import * as bitable from '../src/dingtalk/bitable';

jest.mock('../src/dingtalk/message');
jest.mock('../src/dingtalk/todo');
jest.mock('../src/dingtalk/bitable');

// store must be declared outside the factory so it's accessible in tests
// but jest.mock is hoisted, so we use a module-level object literal
const store: Record<string, string> = {};
jest.mock('ioredis', () => {
  // closure over the module-level `store` doesn't work due to hoisting;
  // instead we use a fresh object captured per-instantiation
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => {
      // access the test store via global to work around hoisting
      const s = (global as Record<string, unknown>).__ioredisStore as Record<string, string> | undefined;
      return s?.[key] ?? null;
    }),
    set: jest.fn(async (key: string, value: string) => {
      const s = (global as Record<string, unknown>).__ioredisStore as Record<string, string> | undefined;
      if (s) s[key] = value;
    }),
    del: jest.fn(async (key: string) => {
      const s = (global as Record<string, unknown>).__ioredisStore as Record<string, string> | undefined;
      if (s) delete s[key];
    }),
  }));
});

const mockedMessage = message as jest.Mocked<typeof message>;
const mockedTodo = todo as jest.Mocked<typeof todo>;
const mockedBitable = bitable as jest.Mocked<typeof bitable>;

describe('executeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // wire up the store for this test run
    const s: Record<string, string> = {};
    (global as Record<string, unknown>).__ioredisStore = s;
    mockedTodo.createTodo.mockResolvedValue('todo_abc');
    mockedBitable.insertTaskRecord.mockResolvedValue('row_xyz');
    mockedMessage.sendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).__ioredisStore;
  });

  it('sends message, creates todo, inserts bitable row, and stores redis mapping', async () => {
    await executeTask({
      bossUserId: 'boss_001',
      bossName: '老板',
      assigneeUserId: 'user_456',
      assigneeName: '小王',
      detail: '完成Q2报告',
      deadline: '2026-05-20',
      summary: '小王需在5月20日前完成Q2报告',
    });

    expect(mockedMessage.sendMessage).toHaveBeenCalledWith(
      'user_456',
      expect.stringContaining('完成Q2报告')
    );
    expect(mockedTodo.createTodo).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeUserId: 'user_456', subject: '完成Q2报告' })
    );
    expect(mockedBitable.insertTaskRecord).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'todo_abc', detail: '完成Q2报告' })
    );

    const redisStore = (global as Record<string, unknown>).__ioredisStore as Record<string, string>;
    expect(redisStore['todo:todo_abc']).toBe(
      JSON.stringify({ rowId: 'row_xyz', bossUserId: 'boss_001', summary: '小王需在5月20日前完成Q2报告' })
    );

    expect(mockedMessage.sendMessage).toHaveBeenCalledWith(
      'boss_001',
      expect.stringContaining('已创建')
    );
  });
});
