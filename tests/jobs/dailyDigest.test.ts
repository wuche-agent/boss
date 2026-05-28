import { buildDailyDigest } from '../../src/jobs/dailyDigest';
import * as bitable from '../../src/dingtalk/bitable';

jest.mock('../../src/dingtalk/bitable');

it('builds the fixed-format boss summary', async () => {
  (bitable.listTaskRecords as jest.Mock)
    .mockResolvedValueOnce([{ rowId: '1', title: 'A', assigneeName: '小王', deptName: '市场部', status: '进行中', deadline: '2026-05-28 18:00' }])
    .mockResolvedValueOnce([{ rowId: '2', title: 'B', assigneeName: '小李', deptName: '销售部', status: '进行中', deadline: '2026-05-28 18:00' }])
    .mockResolvedValueOnce([{ rowId: '3', title: 'C', assigneeName: '小赵', deptName: '运营部', status: '已逾期', deadline: '2026-05-26 18:00' }])
    .mockResolvedValueOnce([{ rowId: '4', title: 'D', assigneeName: '小陈', deptName: '市场部', status: '已完成', deadline: '2026-05-27 18:00' }]);

  const digest = await buildDailyDigest(new Date('2026-05-28T09:00:00.000Z'));
  expect(digest).toContain('进行中任务数：1');
  expect(digest).toContain('今日到期任务数：1');
  expect(digest).toContain('已逾期任务数：1');
  expect(digest).toContain('昨日完成任务数：1');
});
