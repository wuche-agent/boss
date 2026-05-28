import { executeTask } from '../src/executor';
import * as message from '../src/dingtalk/message';
import * as todo from '../src/dingtalk/todo';
import * as user from '../src/dingtalk/user';
import * as bitable from '../src/dingtalk/bitable';

jest.mock('../src/dingtalk/message');
jest.mock('../src/dingtalk/todo');
jest.mock('../src/dingtalk/user');
jest.mock('../src/dingtalk/bitable');

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => {
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
  }))
);

const mockedMessage = message as jest.Mocked<typeof message>;
const mockedTodo = todo as jest.Mocked<typeof todo>;
const mockedUser = user as jest.Mocked<typeof user>;
const mockedBitable = bitable as jest.Mocked<typeof bitable>;

describe('executeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as Record<string, unknown>).__ioredisStore = {};
    mockedUser.searchUserByName.mockResolvedValue({
      kind: 'resolved',
      match: { userId: 'staff_789', unionId: 'union_789', name: '小王', deptName: '市场部' },
    });
    mockedUser.getUserUnionId.mockResolvedValue('boss_union_001');
    mockedTodo.createTodo.mockResolvedValue('todo_abc');
    mockedBitable.createTaskRecord.mockResolvedValue({ rowId: 'row_001', taskId: 'TASK-20260528-001' });
    mockedBitable.updateTaskRecord.mockResolvedValue(undefined);
    mockedMessage.sendCard.mockResolvedValue(undefined);
    mockedMessage.sendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).__ioredisStore;
  });

  it('creates bitable record first, then todo, then updates task metadata and confirms boss', async () => {
    await executeTask({
      bossUserId: 'boss_001',
      bossName: '老板',
      assigneeName: '小王',
      title: 'Q2客户复盘报告',
      detail: '完成Q2报告',
      purpose: '提升销售效率',
      deliverable: '复盘文档',
      deadline: '2026-05-20',
      summary: '小王需在5月20日前完成Q2报告',
      rawIntent: '让小王完成Q2报告',
    });

    expect(mockedUser.searchUserByName).toHaveBeenCalledWith('小王');
    expect(mockedUser.getUserUnionId).toHaveBeenCalledWith('boss_001');
    expect(mockedBitable.createTaskRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Q2客户复盘报告',
        detail: '完成Q2报告',
        purpose: '提升销售效率',
        deliverable: '复盘文档',
        assigneeName: '小王',
        bossUserId: 'boss_001',
        status: '进行中',
      })
    );

    expect(mockedMessage.sendCard).toHaveBeenCalledWith('staff_789', {
      goal: '提升销售效率',
      detail: '完成Q2报告',
      deadline: '2026-05-20',
      bossName: '老板',
      notes: '交付物：复盘文档',
    });

    expect(mockedTodo.createTodo).toHaveBeenCalledWith({
      assigneeUnionId: 'union_789',
      creatorUnionId: 'boss_union_001',
      subject: 'Q2客户复盘报告',
      dueTime: '2026-05-20',
    });

    expect(mockedBitable.updateTaskRecord).toHaveBeenCalledWith(
      'row_001',
      expect.objectContaining({
        待办taskId: 'todo_abc',
        负责人部门: '市场部',
      })
    );

    const redisStore = (global as Record<string, unknown>).__ioredisStore as Record<string, string>;
    expect(redisStore['todo:todo_abc']).toBe(
      JSON.stringify({
        rowId: 'row_001',
        bossUserId: 'boss_001',
        summary: '小王需在5月20日前完成Q2报告',
        title: 'Q2客户复盘报告',
      })
    );

    expect(mockedMessage.sendMessage).toHaveBeenCalledWith(
      'boss_001',
      expect.stringContaining('已创建')
    );
  });

  it('throws and does NOT send card if searchUserByName throws', async () => {
    mockedUser.searchUserByName.mockRejectedValue(new Error('未找到用户'));
    await expect(
      executeTask({
        bossUserId: 'boss_001',
        bossName: '老板',
        assigneeName: '不存在的人',
        title: '标题',
        detail: '内容',
        purpose: '目标',
        deliverable: '交付物',
        deadline: '2026-05-20',
        summary: '摘要',
        rawIntent: '原始想法',
      })
    ).rejects.toThrow('未找到用户');
    expect(mockedMessage.sendCard).not.toHaveBeenCalled();
  });
});
