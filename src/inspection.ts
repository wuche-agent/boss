import { InspectionQuery } from './llm';
import { listTaskRecords } from './dingtalk/bitable';

export async function runInspectionQuery(query: InspectionQuery): Promise<string> {
  const items = await listTaskRecords({
    statuses: query.status ? [query.status] : undefined,
    assigneeName: query.scope === 'person' ? query.target : undefined,
    deptName: query.scope === 'department' ? query.target : undefined,
    timeRange: query.timeRange,
  });

  if (query.scope === 'person') {
    const name = query.target ?? '该同事';
    const lines = items.map(item => `- ${item.title}（${item.status}，截止 ${item.deadline}）`);
    return `${name}当前有 ${items.length} 条${query.status ?? ''}任务：\n${lines.join('\n')}`;
  }

  if (query.scope === 'time' && query.timeRange === 'today') {
    const lines = items.map(item => `- ${item.title} / ${item.assigneeName} / ${item.deadline}`);
    return `今天到期任务共 ${items.length} 条：\n${lines.join('\n')}`;
  }

  const lines = items.map(item => `- ${item.title} / ${item.assigneeName} / ${item.status}`);
  return `查询到 ${items.length} 条任务：\n${lines.join('\n')}`;
}
