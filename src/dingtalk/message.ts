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

export interface TaskCard {
  goal: string;
  detail: string;
  deadline: string;
  bossName: string;
}

export async function sendCard(userId: string, card: TaskCard): Promise<void> {
  const token = await getAccessToken();
  const text =
    `### 你有一个新任务 📋\n` +
    `**目标：** ${card.goal}\n` +
    `**内容：** ${card.detail}\n` +
    `**截止日期：** ${card.deadline}\n` +
    `**来自：** ${card.bossName}`;
  await axios.post(
    'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
    {
      robotCode: process.env.DINGTALK_ROBOT_CODE,
      userIds: [userId],
      msgKey: 'sampleMarkdown',
      msgParam: JSON.stringify({ title: '你有一个新任务', text }),
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );
}
