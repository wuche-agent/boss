import axios from 'axios';
import { sendMessage } from '../../src/dingtalk/message';
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
