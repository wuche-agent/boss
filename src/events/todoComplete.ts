import { redis } from '../redis';
import { sendMessage } from '../dingtalk/message';

interface TodoRecord {
  bossUserId: string;
  summary: string;
}

export async function handleTodoComplete(event: Record<string, unknown>): Promise<void> {
  const taskId = (event.taskId ?? event.id) as string;
  if (!taskId) return;

  const raw = await redis.get(`todo:${taskId}`);
  if (!raw) return;

  const { bossUserId, summary } = JSON.parse(raw) as TodoRecord;
  const finisherName = (event.finisherName ?? '被指派人') as string;

  // Update task record status in Redis
  const taskRaw = await redis.get(`task:${taskId}`);
  if (taskRaw) {
    const task = JSON.parse(taskRaw);
    task.status = '已完成';
    task.completedAt = new Date().toISOString();
    task.completedBy = finisherName;
    await redis.set(`task:${taskId}`, JSON.stringify(task), 'KEEPTTL');
  }

  await sendMessage(bossUserId, `✅ 任务已完成：${summary}\n完成人：${finisherName}`);
}
