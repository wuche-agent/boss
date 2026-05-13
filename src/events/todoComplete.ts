import Redis from 'ioredis';
import { updateTaskStatus } from '../dingtalk/bitable';
import { sendMessage } from '../dingtalk/message';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

interface TodoRecord {
  rowId: string;
  bossUserId: string;
  summary: string;
}

export async function handleTodoComplete(event: Record<string, unknown>): Promise<void> {
  const taskId = (event.taskId ?? event.id) as string;
  if (!taskId) return;

  const raw = await redis.get(`todo:${taskId}`);
  if (!raw) return;

  const { rowId, bossUserId, summary } = JSON.parse(raw) as TodoRecord;
  const finisherName = (event.finisherName ?? '被指派人') as string;

  await updateTaskStatus(rowId, '已完成');
  await sendMessage(bossUserId, `✅ 任务已完成：${summary}\n完成人：${finisherName}`);
}
