import axios from 'axios';
import { createTaskRecord, updateTaskRecord } from '../../src/dingtalk/bitable';
import * as client from '../../src/dingtalk/client';

jest.mock('axios');
jest.mock('../../src/dingtalk/client');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedClient = client as jest.Mocked<typeof client>;

const APP_TOKEN = 'app_token_test';
const TABLE_ID = 'table_id_test';

describe('bitable', () => {
  beforeEach(() => {
    mockedClient.getAccessToken.mockResolvedValue('mock_token');
    process.env.BITABLE_APP_TOKEN = APP_TOKEN;
    process.env.BITABLE_TABLE_ID = TABLE_ID;
  });

  it('creates a task record and returns rowId plus taskId', async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: 'row_xyz' } });

    const result = await createTaskRecord({
      title: 'Q2客户复盘报告',
      detail: '完成Q2报告',
      purpose: '提升销售效率',
      deliverable: '复盘文档',
      assigneeName: '小王',
      assigneeUserId: 'user_456',
      bossName: '老板',
      summary: '小王需在5月20日前完成Q2报告',
      deadline: '2026-05-20',
      bossUserId: 'boss_001',
      rawIntent: '让小王完成Q2报告',
      status: '进行中',
    });
    expect(result.rowId).toBe('row_xyz');
    expect(result.taskId).toContain('TASK-');
  });

  it('updates a task record with todo metadata', async () => {
    mockedAxios.put.mockResolvedValue({ data: {} });

    await updateTaskRecord('row_xyz', {
      待办taskId: 'todo_abc',
      负责人部门: '市场部',
      派发时间: '2026-05-28T10:00:00.000Z',
    });
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('row_xyz'),
      {
        fields: {
          待办taskId: 'todo_abc',
          负责人部门: '市场部',
          派发时间: '2026-05-28T10:00:00.000Z',
        },
      },
      expect.any(Object)
    );
  });
});
