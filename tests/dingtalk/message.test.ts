import axios from 'axios';
import { sendMessage, sendCard, TaskCard } from '../../src/dingtalk/message';
import * as client from '../../src/dingtalk/client';

jest.mock('axios');
jest.mock('../../src/dingtalk/client');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedClient = client as jest.Mocked<typeof client>;

describe('sendMessage', () => {
  beforeEach(() => {
    mockedClient.getAccessToken.mockResolvedValue('mock_token');
    mockedAxios.post.mockResolvedValue({ data: { processQueryKey: 'ok' } });
  });

  it('sends a message to a single user', async () => {
    await sendMessage('user_123', '任务已创建');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
      {
        robotCode: process.env.DINGTALK_ROBOT_CODE,
        userIds: ['user_123'],
        msgKey: 'sampleText',
        msgParam: JSON.stringify({ content: '任务已创建' }),
      },
      { headers: { 'x-acs-dingtalk-access-token': 'mock_token' } }
    );
  });
});

describe('sendCard', () => {
  beforeEach(() => {
    mockedClient.getAccessToken.mockResolvedValue('mock_token');
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  it('sends a markdown card to a single user', async () => {
    const card: TaskCard = {
      goal: '提升销售效率',
      detail: '完成Q2季度销售报告',
      deadline: '2026-05-18',
      bossName: '武彻',
    };
    await sendCard('user_123', card);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
      {
        robotCode: process.env.DINGTALK_ROBOT_CODE,
        userIds: ['user_123'],
        msgKey: 'sampleMarkdown',
        msgParam: JSON.stringify({
          title: '【新任务】提升销售效率',
          text:
            '## 【新任务】提升销售效率\n\n' +
            '🎯 **目标：** 提升销售效率\n\n' +
            '📝 **内容/要求：**\n\n' +
            '完成Q2季度销售报告\n\n' +
            '⏰ **截止/时间：**\n\n' +
            '- 2026-05-18\n\n' +
            '来源：武彻',
        }),
      },
      { headers: { 'x-acs-dingtalk-access-token': 'mock_token' } }
    );
  });
});