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
  });

  it('returns staffId when exact name match is found', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { list: [{ userId: 'staff_001', name: '洋子老师' }] },
    });
    const id = await searchUserByName('洋子老师');
    expect(id).toBe('staff_001');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.dingtalk.com/v1.0/contact/users/search',
      {
        params: { queryWord: '洋子老师', offset: 0, size: 5 },
        headers: { 'x-acs-dingtalk-access-token': 'mock_token' },
      }
    );
  });

  it('returns first result when no exact name match', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { list: [{ userId: 'staff_002', name: '洋子' }] },
    });
    const id = await searchUserByName('洋子老师');
    expect(id).toBe('staff_002');
  });

  it('throws when list is empty', async () => {
    mockedAxios.get.mockResolvedValue({ data: { list: [] } });
    await expect(searchUserByName('不存在的人')).rejects.toThrow('未找到用户');
  });

  it('throws when API returns 403', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Request failed with status code 403'));
    await expect(searchUserByName('洋子老师')).rejects.toThrow();
  });
});
