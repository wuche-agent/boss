import { redis } from '../redis';
import { updateTaskRecord } from '../dingtalk/bitable';
import { sendMessage } from '../dingtalk/message';

interface TodoRecord {
  rowId: string;
  bossUserId: string;
  summary: string;
  title: string;
}

export async function handleTodoComplete(event: Record<string, unknown>): Promise<void> {
  const taskId = (event.taskId ?? event.id) as string;
  if (!taskId) return;

  const raw = await redis.get(`todo:${taskId}`);
  if (!raw) return;

  const { rowId, bossUserId, summary, title } = JSON.parse(raw) as TodoRecord;
  const finisherName = (event.finisherName ?? '被指派人') as string;
  const now = new Date().toISOString();

  await updateTaskRecord(rowId, {
    任务状态: '已完成',
    待办完成时间: now,
    最近一次状态更新时间: now,
    是否逾期: '否',
  });

  await sendMessage(bossUserId, `✅ ${finisherName} 已完成任务《${title}》\n${summary}\n请去查收成果。`);
}
