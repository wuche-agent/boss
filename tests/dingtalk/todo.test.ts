import axios from 'axios';
import { createTodo } from '../../src/dingtalk/todo';
import * as client from '../../src/dingtalk/client';

jest.mock('axios');
jest.mock('../../src/dingtalk/client');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedClient = client as jest.Mocked<typeof client>;

describe('createTodo', () => {
  beforeEach(() => {
    mockedClient.getAccessToken.mockResolvedValue('mock_token');
    mockedAxios.post.mockResolvedValue({ data: { taskId: 'todo_abc123' } });
  });

  it('creates a todo and returns the taskId', async () => {
    const taskId = await createTodo({
      assigneeUnionId: 'union_456',
      creatorUnionId: 'boss_union_001',
      subject: '完成Q2季度销售报告',
      dueTime: '2026-05-20',
    });
    expect(taskId).toBe('todo_abc123');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.dingtalk.com/v1.0/todo/users/union_456/tasks',
      expect.objectContaining({
        subject: '完成Q2季度销售报告',
        creatorId: 'boss_union_001',
        executorIds: ['union_456'],
      }),
      expect.any(Object)
    );
  });
});
