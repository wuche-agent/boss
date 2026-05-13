import axios from 'axios';
import { getAccessToken } from './client';

// NOTE: Verify this base path against your DingTalk workspace's Bitable API docs
// before going to production — the exact path varies by workspace configuration.
const BASE = 'https://api.dingtalk.com/v1.0/doc/workspaces';

function getEnvOrThrow(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export interface TaskRecord {
  detail: string;
  assigneeName: string;
  assigneeUserId: string;
  deadline: string;
  taskId: string;
  bossUserId: string;
}

export async function insertTaskRecord(record: TaskRecord): Promise<string> {
  const token = await getAccessToken();
  const appToken = getEnvOrThrow('BITABLE_APP_TOKEN');
  const tableId = getEnvOrThrow('BITABLE_TABLE_ID');

  const response = await axios.post(
    `${BASE}/${appToken}/tables/${tableId}/records`,
    {
      fields: {
        任务描述: record.detail,
        负责人: record.assigneeName,
        截止日期: record.deadline,
        状态: '进行中',
        创建时间: new Date().toISOString(),
        任务ID: record.taskId,
        指派人ID: record.bossUserId,
      },
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );

  const { id } = response.data as { id: string };
  return id;
}

export async function updateTaskStatus(rowId: string, status: string): Promise<void> {
  const token = await getAccessToken();
  const appToken = getEnvOrThrow('BITABLE_APP_TOKEN');
  const tableId = getEnvOrThrow('BITABLE_TABLE_ID');

  await axios.put(
    `${BASE}/${appToken}/tables/${tableId}/records/${rowId}`,
    { fields: { 状态: status } },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );
}
