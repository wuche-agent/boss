import { redis } from './redis';
import { sendMessage } from './dingtalk/message';
import { createTodo } from './dingtalk/todo';
import { insertTaskRecord } from './dingtalk/bitable';

export interface TaskParams {
  bossUserId: string;
  bossName: string;
  assigneeUserId: string;
  assigneeName: string;
  detail: string;
  deadline: string; // ISO date string
  summary: string;
}

export async function executeTask(params: TaskParams): Promise<void> {
  // 1) Notify assignee
  await sendMessage(
    params.assigneeUserId,
    `你收到一个新任务（来自${params.bossName}）：\n${params.detail}\n截止日期：${params.deadline}`
  );

  // 2) Create DingTalk todo
  const taskId = await createTodo({
    assigneeUserId: params.assigneeUserId,
    creatorUserId: params.bossUserId,
    subject: params.detail,
    dueTime: params.deadline,
  });

  // 3) Insert bitable row
  const rowId = await insertTaskRecord({
    detail: params.detail,
    assigneeName: params.assigneeName,
    assigneeUserId: params.assigneeUserId,
    deadline: params.deadline,
    taskId,
    bossUserId: params.bossUserId,
  });

  // 4) Store mapping in Redis (TTL: 30 days)
  await redis.set(
    `todo:${taskId}`,
    JSON.stringify({ rowId, bossUserId: params.bossUserId, summary: params.summary }),
    'EX',
    30 * 24 * 60 * 60
  );

  // 5) Confirm to boss
  await sendMessage(
    params.bossUserId,
    `任务已创建并通知到${params.assigneeName}：\n${params.summary}`
  );
}
