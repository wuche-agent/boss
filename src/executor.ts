import { redis } from './redis';
import { sendMessage, sendCard } from './dingtalk/message';
import { createTodo } from './dingtalk/todo';
import { insertTaskRecord } from './dingtalk/bitable';
import { searchUserByName } from './dingtalk/user';

export interface TaskParams {
  bossUserId: string;
  bossName: string;
  assigneeName: string;
  goal: string;
  detail: string;
  deadline: string;
  summary: string;
}

export async function executeTask(params: TaskParams): Promise<void> {
  // 1) Resolve assignee staffId
  const assigneeUserId = await searchUserByName(params.assigneeName);
  console.log(`[executor] resolved ${params.assigneeName} → ${assigneeUserId}`);

  // 2) Send markdown card to assignee
  await sendCard(assigneeUserId, {
    goal: params.goal,
    detail: params.detail,
    deadline: params.deadline,
    bossName: params.bossName,
  });

  // 3) Create DingTalk todo
  const taskId = await createTodo({
    assigneeUserId,
    creatorUserId: params.bossUserId,
    subject: params.detail,
    dueTime: params.deadline,
  });

  // 4) Insert bitable row
  const rowId = await insertTaskRecord({
    detail: params.detail,
    assigneeName: params.assigneeName,
    assigneeUserId,
    deadline: params.deadline,
    taskId,
    bossUserId: params.bossUserId,
  });

  // 5) Store Redis mapping (TTL: 30 days)
  await redis.set(
    `todo:${taskId}`,
    JSON.stringify({ rowId, bossUserId: params.bossUserId, summary: params.summary }),
    'EX',
    30 * 24 * 60 * 60
  );

  // 6) Confirm to boss
  await sendMessage(
    params.bossUserId,
    `✅ 任务已创建并通知到${params.assigneeName}：\n${params.summary}`
  );
}
