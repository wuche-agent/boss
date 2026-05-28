import { runOverdueSweep } from '../../src/jobs/overdueSweep';
import * as bitable from '../../src/dingtalk/bitable';

jest.mock('../../src/dingtalk/bitable');

it('marks in-progress past-due tasks as overdue', async () => {
  (bitable.listTaskRecords as jest.Mock).mockResolvedValue([
    { rowId: 'row_001', status: '进行中', deadline: '2026-05-20 18:00' },
  ]);

  await runOverdueSweep(new Date('2026-05-21T10:00:00.000Z'));

  expect(bitable.updateTaskRecord).toHaveBeenCalledWith(
    'row_001',
    expect.objectContaining({ 任务状态: '已逾期', 是否逾期: '是' })
  );
});
