import { redis } from './redis';
import { sendMessage, sendCard } from './dingtalk/message';
import { createTodo } from './dingtalk/todo';
import { createTaskRecord, updateTaskRecord } from './dingtalk/bitable';
import { searchUserByName, getUserUnionId } from './dingtalk/user';

export interface TaskParams {
  bossUserId: string;
  bossName: string;
  assigneeName: string;
  title: string;
  detail: string;
  purpose: string;
  deliverable: string;
  deadline: string;
  summary: string;
  rawIntent: string;
}

export async function executeTask(params: TaskParams): Promise<void> {
  const lookup = await searchUserByName(params.assigneeName);
  if (lookup.kind === 'ambiguous') {
    throw new Error(`找到多个同名用户"${params.assigneeName}"，请补充确认部门后再试`);
  }

  const assignee = lookup.match;
  const { rowId } = await createTaskRecord({
    title: params.title,
    detail: params.detail,
    purpose: params.purpose,
    deliverable: params.deliverable,
    assigneeName: assignee.name,
    assigneeUserId: assignee.userId,
    bossName: params.bossName,
    bossUserId: params.bossUserId,
    deadline: params.deadline,
    rawIntent: params.rawIntent,
    summary: params.summary,
    status: '进行中',
  });

  await sendCard(assignee.userId, {
    goal: params.purpose,
    detail: params.detail,
    deadline: params.deadline,
    bossName: params.bossName,
    notes: `交付物：${params.deliverable}`,
  });

  const bossUnionId = await getUserUnionId(params.bossUserId);
  const todoTaskId = await createTodo({
    assigneeUnionId: assignee.unionId,
    creatorUnionId: bossUnionId,
    subject: params.title,
    dueTime: params.deadline,
  });

  await updateTaskRecord(rowId, {
    待办taskId: todoTaskId,
    负责人部门: assignee.deptName,
    派发时间: new Date().toISOString(),
    最近一次状态更新时间: new Date().toISOString(),
  });

  await redis.set(
    `todo:${todoTaskId}`,
    JSON.stringify({
      rowId,
      bossUserId: params.bossUserId,
      summary: params.summary,
      title: params.title,
    }),
    'EX',
    30 * 24 * 60 * 60
  );

  await sendMessage(
    params.bossUserId,
    `✅ 任务已创建并通知到${assignee.name}：\n${params.summary}`
  );
}
