import { executeTask } from '../src/executor';
import * as message from '../src/dingtalk/message';
import * as todo from '../src/dingtalk/todo';
import * as bitable from '../src/dingtalk/bitable';

jest.mock('../src/dingtalk/message');
jest.mock('../src/dingtalk/todo');
jest.mock('../src/dingtalk/bitable');
jest.mock('ioredis', () => {
  const store: Record<string, string> = {};
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => store[key] ?? null),
    set: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    del: jest.fn(),
  }));
});

const mockedMessage = message as jest.Mocked<typeof message>;
const mockedTodo = todo as jest.Mocked<typeof todo>;
const mockedBitable = bitable as jest.Mocked<typeof bitable>;

describe('executeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTodo.createTodo.mockResolvedValue('todo_abc');
    mockedBitable.insertTaskRecord.mockResolvedValue('row_xyz');
    mockedMessage.sendMessage.mockResolvedValue(undefined);
  });

  it('sends message, creates todo, and inserts bitable row', async () => {
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
    expect(mockedMessage.sendMessage).toHaveBeenCalledWith(
      'boss_001',
      expect.stringContaining('已创建')
    );
  });
});
