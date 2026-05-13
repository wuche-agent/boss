import axios from 'axios';
import { getAccessToken } from './client';

export interface CreateTodoParams {
  assigneeUserId: string;
  creatorUserId: string;
  subject: string;
  dueTime: string; // ISO date string e.g. "2026-05-20"
}

export async function createTodo(params: CreateTodoParams): Promise<string> {
  const token = await getAccessToken();
  const dueTimestamp = new Date(params.dueTime).getTime();

  const response = await axios.post(
    `https://api.dingtalk.com/v1.0/todo/users/${params.assigneeUserId}/tasks`,
    {
      subject: params.subject,
      creatorId: params.creatorUserId,
      executorIds: [params.assigneeUserId],
      dueTime: dueTimestamp,
      notifyConfigs: { dingNotify: '1' },
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );

  const { taskId } = response.data as { taskId: string };
  return taskId;
}
