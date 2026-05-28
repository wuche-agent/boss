import axios from 'axios';
import { getAccessToken } from './client';

const BASE = 'https://api.dingtalk.com/v1.0/doc/workspaces';

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export interface CreateTaskRecordInput {
  title: string;
  detail: string;
  purpose: string;
  deliverable: string;
  assigneeName: string;
  assigneeUserId: string;
  bossName: string;
  bossUserId: string;
  deadline: string;
  rawIntent: string;
  summary: string;
  status: '进行中';
}

export interface TaskListItem {
  rowId: string;
  title: string;
  assigneeName: string;
  deptName: string;
  status: string;
  deadline: string;
}

export async function createTaskRecord(input: CreateTaskRecordInput): Promise<{ rowId: string; taskId: string }> {
  const token = await getAccessToken();
  const appToken = getEnvOrThrow('BITABLE_APP_TOKEN');
  const tableId = getEnvOrThrow('BITABLE_TABLE_ID');
  const now = new Date().toISOString();
  const taskId = `TASK-${Date.now()}`;

  const response = await axios.post(
    `${BASE}/${appToken}/tables/${tableId}/records`,
    {
      fields: {
        任务ID: taskId,
        任务标题: input.title,
        任务内容: input.detail,
        任务目的: input.purpose,
        交付物: input.deliverable,
        负责人姓名: input.assigneeName,
        负责人userId: input.assigneeUserId,
        老板姓名: input.bossName,
        老板userId: input.bossUserId,
        截止时间: input.deadline,
        任务状态: input.status,
        创建时间: now,
        确认时间: now,
        老板原始想法: input.rawIntent,
        AI整理摘要: input.summary,
      },
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );

  return { rowId: (response.data as { id: string }).id, taskId };
}

export async function updateTaskRecord(rowId: string, fields: Record<string, string>): Promise<void> {
  const token = await getAccessToken();
  const appToken = getEnvOrThrow('BITABLE_APP_TOKEN');
  const tableId = getEnvOrThrow('BITABLE_TABLE_ID');

  await axios.put(
    `${BASE}/${appToken}/tables/${tableId}/records/${rowId}`,
    { fields },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );
}

export async function listTaskRecords(_filters: {
  statuses?: string[];
  assigneeName?: string;
  deptName?: string;
  timeRange?: 'today' | 'this_week' | 'recent_3_days' | 'all';
}): Promise<TaskListItem[]> {
  const token = await getAccessToken();
  const appToken = getEnvOrThrow('BITABLE_APP_TOKEN');
  const tableId = getEnvOrThrow('BITABLE_TABLE_ID');

  const response = await axios.get(
    `${BASE}/${appToken}/tables/${tableId}/records`,
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );

  const filters = _filters;
  const items = ((response.data as { items?: Array<{ id: string; fields: Record<string, string> }> }).items ?? [])
    .map(item => ({
      rowId: item.id,
      title: item.fields['任务标题'],
      assigneeName: item.fields['负责人姓名'],
      deptName: item.fields['负责人部门'] ?? '',
      status: item.fields['任务状态'],
      deadline: item.fields['截止时间'],
    }));

  return items.filter(item => {
    if (filters.statuses && !filters.statuses.includes(item.status)) return false;
    if (filters.assigneeName && item.assigneeName !== filters.assigneeName) return false;
    if (filters.deptName && item.deptName !== filters.deptName) return false;
    return true;
  });
}
