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

  it('re-fetches token when cached token is within the 60s expiry buffer', async () => {
    const realNow = Date.now;
    const fakeNow = jest.fn().mockReturnValue(0);
    global.Date.now = fakeNow;

    // expireIn=50s → expiresAt=50_000ms; at t=0: now+60_000=60_000 > 50_000 → stale, re-fetch
    mockedAxios.post.mockResolvedValueOnce({
      data: { accessToken: 'token_expiring_soon', expireIn: 50 },
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: { accessToken: 'token_fresh', expireIn: 7200 },
    });

    await getAccessToken();
    const token = await getAccessToken();
    expect(token).toBe('token_fresh');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);

    global.Date.now = realNow;
  });
});
