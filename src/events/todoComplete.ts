import { redis } from '../redis';
import { updateTaskStatus } from '../dingtalk/bitable';
import { sendMessage } from '../dingtalk/message';

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
