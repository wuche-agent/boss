import axios from 'axios';
import { getAccessToken } from './client';

export interface UserIdentity {
  userId: string;
  unionId: string;
}

async function getAllDeptIds(token: string): Promise<number[]> {
  const resp = await axios.get('https://oapi.dingtalk.com/department/list', {
    params: { id: 1, fetch_child: true, access_token: token },
  });
  const body = resp.data as { errcode?: number; department?: Array<{ id: number }> };
  if (body.errcode !== 0) {
    console.log('[user] getAllDeptIds error:', body);
    return [1];
  }
  const ids = (body.department ?? []).map(d => d.id);
  console.log('[user] depts found:', ids);
  return ids.length > 0 ? ids : [1];
}

async function findByNick(name: string, token: string): Promise<UserIdentity | null> {
  const deptIds = await getAllDeptIds(token);
  console.log('[user] scanning depts:', deptIds);

  for (const deptId of deptIds) {
    let cursor = 0;
    while (true) {
      const resp = await axios.post(
        `https://oapi.dingtalk.com/topapi/v2/user/list?access_token=${token}`,
        { dept_id: deptId, cursor, size: 100 },
      );
      const body = resp.data as { errcode?: number; errmsg?: string; result?: { has_more: boolean; next_cursor: number; list: Array<{ userid: string; unionid: string; name: string; remark?: string; nick?: string }> } };
      if (body.errcode !== 0) {
        console.log(`[user] topapi/v2/user/list dept=${deptId} error:`, body.errcode, body.errmsg);
        break;
      }
      const result = body.result;
      if (!result) break;
      console.log(`[user] dept=${deptId} cursor=${cursor} users:`, result.list.map(u => `${u.name}(remark=${u.remark},nick=${u.nick})`));

      for (const user of result.list) {
        if (user.name === name || user.remark === name || user.nick === name) {
          return { userId: user.userid, unionId: user.unionid };
        }
      }

      if (!result.has_more) break;
      cursor = result.next_cursor;
    }
  }

  return null;
}

export async function searchUserByName(name: string): Promise<UserIdentity> {
  const token = await getAccessToken();

  // Fast path: search API matches real name
  try {
    const resp = await axios.get('https://api.dingtalk.com/v1.0/contact/users/search', {
      params: { queryWord: name, offset: 0, size: 10 },
      headers: { 'x-acs-dingtalk-access-token': token },
    });
    const data = resp.data as { list?: unknown[] };
    const userIds = (data.list ?? []).map(item =>
      typeof item === 'string' ? item : (item as { userId: string }).userId
    );
    if (userIds.length > 0) {
      const userId = userIds[0];
      // Fetch unionId via user/get
      const detail = await axios.post(
        `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${token}`,
        { userid: userId }
      );
      const unionId = (detail.data.result as { unionid: string }).unionid;
      return { userId, unionId };
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status !== 404) throw err;
  }

  // Slow path: scan org members for nick / remark match
  const matched = await findByNick(name, token);
  if (matched) return matched;

  throw new Error(`未找到用户"${name}"，请确认通讯录中存在该成员（真实姓名或花名）`);
}

export async function getUserUnionId(userId: string): Promise<string> {
  const token = await getAccessToken();
  const resp = await axios.post(
    `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${token}`,
    { userid: userId }
  );
  return (resp.data.result as { unionid: string }).unionid;
}
