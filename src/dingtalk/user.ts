import axios from 'axios';
import { getAccessToken } from './client';

export async function searchUserByName(name: string): Promise<string> {
  const token = await getAccessToken();
  const response = await axios.get('https://api.dingtalk.com/v1.0/contact/users/search', {
    params: { queryWord: name, offset: 0, size: 5 },
    headers: { 'x-acs-dingtalk-access-token': token },
  });

  const list = (response.data as { list?: { userId: string; name: string }[] }).list ?? [];
  const match = list.find(u => u.name === name) ?? list[0];
  if (!match) throw new Error(`未找到用户"${name}"，请确认通讯录中存在该成员`);
  return match.userId;
}
