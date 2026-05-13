import axios from 'axios';

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const response = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
    appKey: process.env.DINGTALK_APP_KEY,
    appSecret: process.env.DINGTALK_APP_SECRET,
  });

  const { accessToken, expireIn } = response.data as { accessToken: string; expireIn: number };
  tokenCache = {
    token: accessToken,
    expiresAt: now + expireIn * 1000,
  };
  return accessToken;
}

export function _resetTokenCacheForTesting(): void {
  tokenCache = null;
}
