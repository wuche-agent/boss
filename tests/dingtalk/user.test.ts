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

  it('returns a resolved match with department info', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { list: [{ userId: 'user_1', name: '王磊', unionId: 'union_1', deptName: '市场部' }] },
    });

    await expect(searchUserByName('王磊')).resolves.toEqual({
      kind: 'resolved',
      match: { userId: 'user_1', unionId: 'union_1', name: '王磊', deptName: '市场部' },
    });
  });

  it('returns ambiguous candidates when multiple exact names exist', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        list: [
          { userId: 'user_1', name: '王磊', unionId: 'union_1', deptName: '市场部' },
          { userId: 'user_2', name: '王磊', unionId: 'union_2', deptName: '销售部' },
        ],
      },
    });

    const result = await searchUserByName('王磊');
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.candidates).toHaveLength(2);
    }
  });

  it('throws when no assignee match exists', async () => {
    mockedAxios.get.mockResolvedValue({ data: { list: [] } });
    await expect(searchUserByName('不存在的人')).rejects.toThrow('未找到用户');
  });
});
