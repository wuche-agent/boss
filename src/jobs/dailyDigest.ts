import { listTaskRecords } from '../dingtalk/bitable';

export async function buildDailyDigest(_now: Date = new Date()): Promise<string> {
  const [inProgress, dueToday, overdue, completedRecently] = await Promise.all([
    listTaskRecords({ statuses: ['进行中'] }),
    listTaskRecords({ statuses: ['进行中'], timeRange: 'today' }),
    listTaskRecords({ statuses: ['已逾期'] }),
    listTaskRecords({ statuses: ['已完成'], timeRange: 'recent_3_days' }),
  ]);

  const riskLines = overdue
    .slice(0, 3)
    .map(item => `- ${item.title} / ${item.assigneeName} / 截止 ${item.deadline}`);

  return [
    '老板，早上好。今日任务巡检摘要如下：',
    `进行中任务数：${inProgress.length}`,
    `今日到期任务数：${dueToday.length}`,
    `已逾期任务数：${overdue.length}`,
    `昨日完成任务数：${completedRecently.length}`,
    '重点风险任务：',
    ...(riskLines.length > 0 ? riskLines : ['- 暂无']),
  ].join('\n');
}
