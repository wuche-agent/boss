import axios from 'axios';
import { getAccessToken } from './client';

export async function sendMessage(userId: string, content: string): Promise<void> {
  const token = await getAccessToken();
  await axios.post(
    'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
    {
      robotCode: process.env.DINGTALK_ROBOT_CODE,
      userIds: [userId],
      msgKey: 'sampleText',
      msgParam: JSON.stringify({ content }),
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );
}
