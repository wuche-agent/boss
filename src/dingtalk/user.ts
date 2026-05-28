import axios from 'axios';
import { getAccessToken } from './client';

export interface AssigneeMatch {
  userId: string;
  unionId: string;
  name: string;
  deptName: string;
}

export type AssigneeLookupResult =
  | { kind: 'resolved'; match: AssigneeMatch }
  | { kind: 'ambiguous'; candidates: AssigneeMatch[] };

export async function searchUserByName(name: string): Promise<AssigneeLookupResult> {
  const token = await getAccessToken();
  const response = await axios.get('https://api.dingtalk.com/v1.0/contact/users/search', {
    params: { queryWord: name, offset: 0, size: 10 },
    headers: { 'x-acs-dingtalk-access-token': token },
  });

  const rawList = (response.data as { list?: Array<Record<string, string>> }).list ?? [];
  const exact = rawList
    .filter(item => item.name === name || item.nick === name || item.remark === name)
    .map(item => ({
      userId: item.userId,
      unionId: item.unionId,
      name: item.name,
      deptName: item.deptName ?? '未知部门',
    }));

  if (exact.length === 1) {
    return { kind: 'resolved', match: exact[0] };
  }

  if (exact.length > 1) {
    return { kind: 'ambiguous', candidates: exact };
  }

  throw new Error(`未找到用户"${name}"，请确认通讯录中存在该成员`);
}

export async function getUserUnionId(userId: string): Promise<string> {
  const token = await getAccessToken();
  const resp = await axios.post(
    `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${token}`,
    { userid: userId }
  );
  return (resp.data.result as { unionid: string }).unionid;
}
