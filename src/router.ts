interface MessageEvent {
  senderId?: string;
  senderStaffId?: string;
  conversationType?: string;
  isInAtList?: boolean;
  text?: { content: string };
}

export function isAuthorizedMessage(event: MessageEvent): boolean {
  const whitelist = (process.env.BOSS_USER_IDS ?? '').split(',').filter(Boolean);
  const id = event.senderStaffId ?? event.senderId ?? '';
  // Empty whitelist = open to all
  if (whitelist.length > 0 && !whitelist.includes(id)) return false;
  if (event.conversationType === '2' && !event.isInAtList) return false;
  return true;
}

export function extractMessageText(event: MessageEvent): string {
  return (event.text?.content ?? '').trim();
}
