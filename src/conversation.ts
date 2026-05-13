import Redis from 'ioredis';

export type SessionStep =
  | 'awaiting_assignee'
  | 'awaiting_deadline'
  | 'awaiting_detail'
  | 'awaiting_confirm'
  | 'done';

export interface Session {
  step: SessionStep;
  raw_intent: string;
  assignee_user_id?: string;
  assignee_name?: string;
  deadline?: string;
  detail?: string;
}

const SESSION_TTL = 30 * 60; // 30 minutes in seconds
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

export async function getSession(userId: string): Promise<Session | null> {
  const raw = await redis.get(`session:${userId}`);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function setSession(userId: string, session: Session): Promise<void> {
  await redis.set(`session:${userId}`, JSON.stringify(session), 'EX', SESSION_TTL);
}

export async function clearSession(userId: string): Promise<void> {
  await redis.del(`session:${userId}`);
}
