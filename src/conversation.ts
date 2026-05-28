import { redis } from './redis';

export type SessionStep = 'clarifying' | 'awaiting_confirm' | 'done';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PendingTask {
  title: string;
  assignee_name: string;
  deadline: string;
  detail: string;
  purpose: string;
  deliverable: string;
  summary: string;
  raw_intent: string;
  notes?: string;
}

export interface PendingAssigneeSelection {
  originalName: string;
  candidates: Array<{
    userId: string;
    unionId: string;
    name: string;
    deptName: string;
  }>;
}

export interface Session {
  step: SessionStep;
  history: ConversationTurn[];
  pending_task?: PendingTask;
  pending_assignee_selection?: PendingAssigneeSelection;
}

const SESSION_TTL = 30 * 60;

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
