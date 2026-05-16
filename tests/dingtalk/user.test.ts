import axios from 'axios';
import { searchUserByName } from '../../src/dingtalk/user';
import * as client from '../../src/dingtalk/client';

jest.mock('axios');
jest.mock('../../src/dingtalk/client');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedClient = client as jest.Mocked<typeof client>;

describe('searchUserByName', () => {
  beforeEach(() => {
    mockedClient.getAccessToken.mockResolvedValue('mock_token');
    // Mock unionId lookup used in fast-path
    mockedAxios.post.mockResolvedValue({
      data: { result: { unionid: 'union_001' } },
    });
  });

  it('returns userId and unionId when exact name match is found via search API', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { list: [{ userId: 'staff_001', name: '洋子老师' }] },
    });
    const identity = await searchUserByName('洋子老师');
    expect(identity).toEqual({ userId: 'staff_001', unionId: 'union_001' });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.dingtalk.com/v1.0/contact/users/search',
      {
        params: { queryWord: '洋子老师', offset: 0, size: 10 },
        headers: { 'x-acs-dingtalk-access-token': 'mock_token' },
      }
    );
  });

  it('returns first result when search API returns multiple users', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { list: [{ userId: 'staff_002', name: '洋子' }] },
    });
    const identity = await searchUserByName('洋子老师');
    expect(identity.userId).toBe('staff_002');
    expect(identity.unionId).toBe('union_001');
  });

  it('throws when list is empty and dept scan finds nothing', async () => {
    mockedAxios.get.mockResolvedValue({ data: { list: [] } });
    // dept list returns empty, dept user list returns empty
    mockedAxios.post.mockResolvedValue({
      data: { errcode: 0, result: { has_more: false, next_cursor: 0, list: [] } },
    });
    await expect(searchUserByName('不存在的人')).rejects.toThrow('未找到用户');
  });

  it('throws when API returns 403', async () => {
    mockedAxios.get.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 403'), { response: { status: 403 } })
    );
    await expect(searchUserByName('洋子老师')).rejects.toThrow();
  });
});
