import { runInspectionQuery } from '../src/inspection';
import * as bitable from '../src/dingtalk/bitable';

jest.mock('../src/dingtalk/bitable');

it('formats person-scope in-progress tasks', async () => {
  (bitable.listTaskRecords as jest.Mock).mockResolvedValue([
    {
      rowId: 'row_001',
      title: 'Q2客户复盘报告',
      assigneeName: '小王',
      deptName: '市场部',
      status: '进行中',
      deadline: '2026-05-30 18:00',
    },
  ]);

  const reply = await runInspectionQuery({
    scope: 'person',
    target: '小王',
    status: '进行中',
    timeRange: 'all',
  });

  expect(reply).toContain('小王当前有 1 条进行中任务');
  expect(reply).toContain('Q2客户复盘报告');
});

it('formats due-today risk summaries', async () => {
  (bitable.listTaskRecords as jest.Mock).mockResolvedValue([
    {
      rowId: 'row_002',
      title: '经营会材料',
      assigneeName: '王磊',
      deptName: '市场部',
      status: '进行中',
      deadline: '2026-05-28 18:00',
    },
  ]);

  const reply = await runInspectionQuery({
    scope: 'time',
    timeRange: 'today',
    status: '进行中',
  });

  expect(reply).toContain('今天到期任务共 1 条');
  expect(reply).toContain('经营会材料');
});
