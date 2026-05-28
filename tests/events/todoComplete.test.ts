import { handleTodoComplete } from '../../src/events/todoComplete';
import * as message from '../../src/dingtalk/message';
import * as bitable from '../../src/dingtalk/bitable';

jest.mock('../../src/dingtalk/message');
jest.mock('../../src/dingtalk/bitable');
jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    get: jest.fn(async () => JSON.stringify({ rowId: 'row_001', bossUserId: 'boss_001', summary: '小王提交Q2复盘报告', title: 'Q2客户复盘报告' })),
  }))
);

it('updates bitable and notifies boss when todo completes', async () => {
  await handleTodoComplete({ taskId: 'todo_001', finisherName: '小王' });
  expect(bitable.updateTaskRecord).toHaveBeenCalledWith(
    'row_001',
    expect.objectContaining({
      任务状态: '已完成',
      待办完成时间: expect.any(String),
    })
  );
  expect(message.sendMessage).toHaveBeenCalledWith(
    'boss_001',
    expect.stringContaining('请去查收成果')
  );
});
