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
  notes?: string;
}

export async function sendCard(userId: string, card: TaskCard): Promise<void> {
  const token = await getAccessToken();
  const text =
    `## 【新任务】${card.goal}\n\n` +
    `🎯 **目标：** ${card.goal}\n\n` +
    `📝 **内容/要求：**\n\n` +
    `${card.detail}\n\n` +
    `⏰ **截止/时间：**\n\n` +
    `- ${card.deadline}\n\n` +
    (card.notes ? `📊 **后续/备注：** ${card.notes}\n\n` : '') +
    `来源：${card.bossName}`;
  await axios.post(
    'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
    {
      robotCode: process.env.DINGTALK_ROBOT_CODE,
      userIds: [userId],
      msgKey: 'sampleMarkdown',
      msgParam: JSON.stringify({ title: `【新任务】${card.goal}`, text }),
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );
}
