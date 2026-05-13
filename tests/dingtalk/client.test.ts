import axios from 'axios';
import { getAccessToken, _resetTokenCacheForTesting } from '../../src/dingtalk/client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('dingtalk client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetTokenCacheForTesting();
  });

  it('fetches and caches an access token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { accessToken: 'test_token_123', expireIn: 7200 },
    });

    const token = await getAccessToken();
    expect(token).toBe('test_token_123');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('returns cached token on second call within TTL', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { accessToken: 'test_token_123', expireIn: 7200 },
    });

    await getAccessToken();
    const token = await getAccessToken();
    expect(token).toBe('test_token_123');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1); // only fetched once
  });
});
