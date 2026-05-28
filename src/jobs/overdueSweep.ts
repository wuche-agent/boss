import { listTaskRecords, updateTaskRecord } from '../dingtalk/bitable';

export async function runOverdueSweep(now: Date = new Date()): Promise<void> {
  const tasks = await listTaskRecords({ statuses: ['进行中'] });

  for (const task of tasks) {
    const deadline = new Date(task.deadline);
    if (deadline.getTime() >= now.getTime()) continue;

    const overdueDays = Math.max(
      1,
      Math.ceil((now.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000))
    );

    await updateTaskRecord(task.rowId, {
      任务状态: '已逾期',
      是否逾期: '是',
      逾期天数: String(overdueDays),
      最近一次状态更新时间: now.toISOString(),
    });
  }
}
