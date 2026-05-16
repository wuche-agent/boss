import { redis } from './redis';
import { sendMessage, sendCard } from './dingtalk/message';
import { createTodo } from './dingtalk/todo';
import { searchUserByName, getUserUnionId } from './dingtalk/user';

export interface TaskParams {
  bossUserId: string;
  bossName: string;
  assigneeName: string;
  goal: string;
  detail: string;
  deadline: string;
  summary: string;
  notes?: string;
}

export async function executeTask(params: TaskParams): Promise<void> {
  // 1) Resolve assignee identifiers
  const { userId: assigneeUserId, unionId: assigneeUnionId } = await searchUserByName(params.assigneeName);
  console.log(`[executor] resolved ${params.assigneeName} → userId=${assigneeUserId} unionId=${assigneeUnionId}`);

  console.log('[executor] getting bossUnionId...');
  const bossUnionId = await getUserUnionId(params.bossUserId);
  console.log('[executor] bossUnionId:', bossUnionId);

  // 2) Send markdown card to assignee
  console.log('[executor] sending card to', assigneeUserId);
  await sendCard(assigneeUserId, {
    goal: params.goal,
    detail: params.detail,
    deadline: params.deadline,
    bossName: params.bossName,
    notes: params.notes,
  });

  // 3) Create DingTalk todo (requires unionId)
  const taskId = await createTodo({
    assigneeUnionId,
    creatorUnionId: bossUnionId,
    subject: params.detail,
    dueTime: params.deadline,
  });

  const TTL_30D = 30 * 24 * 60 * 60;

  // 4) Store full task record in Redis
  await redis.set(
    `task:${taskId}`,
    JSON.stringify({
      taskId,
      goal: params.goal,
      detail: params.detail,
      assigneeName: params.assigneeName,
      assigneeUserId,
      deadline: params.deadline,
      bossUserId: params.bossUserId,
      bossName: params.bossName,
      status: '进行中',
      createdAt: new Date().toISOString(),
      summary: params.summary,
    }),
    'EX',
    TTL_30D
  );

  // 5) Store todo→task mapping for completion tracking
  await redis.set(
    `todo:${taskId}`,
    JSON.stringify({ bossUserId: params.bossUserId, summary: params.summary }),
    'EX',
    TTL_30D
  );

  // 6) Confirm to boss
  await sendMessage(
    params.bossUserId,
    `✅ 任务已创建并通知到${params.assigneeName}：\n${params.summary}`
  );
}

