import type { Redis } from 'ioredis';

export interface SessionRecord {
  zico_user_id: string;
  channel: 'telegram';
  chat_id: number;
  jwt: string;
  expires_at: number; // epoch seconds
}

const keySession = (zicoUserId: string, chatId: number) => `session:${zicoUserId}:tg:${chatId}`;

export async function saveSession(redis: Redis, rec: SessionRecord): Promise<void> {
  const k = keySession(rec.zico_user_id, rec.chat_id);
  const ttl = Math.max(1, rec.expires_at - Math.floor(Date.now() / 1000));
  await redis.set(k, JSON.stringify(rec), 'EX', ttl);
}

export async function getSession(
  redis: Redis,
  zicoUserId: string,
  chatId: number,
): Promise<SessionRecord | null> {
  const k = keySession(zicoUserId, chatId);
  const raw = await redis.get(k);
  return raw ? (JSON.parse(raw) as SessionRecord) : null;
}


