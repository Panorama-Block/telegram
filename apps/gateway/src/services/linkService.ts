import { Redis } from 'ioredis';

export interface LinkData {
  telegram_user_id: string;
  zico_user_id: string;
  username: string | null;
  language_code: string | null;
  linked_at: number;
  status: 'linked' | 'unlinked';
}

export async function saveLink(redis: Redis, linkData: LinkData): Promise<void> {
  const key = `link:${linkData.telegram_user_id}`;
  await redis.hset(key, linkData);
  await redis.expire(key, 86400 * 30); // 30 days
}

export async function getLink(redis: Redis, telegramUserId: string): Promise<LinkData | null> {
  const key = `link:${telegramUserId}`;
  const data = await redis.hgetall(key);
  
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  
  return {
    telegram_user_id: data.telegram_user_id!,
    zico_user_id: data.zico_user_id!,
    username: data.username || null,
    language_code: data.language_code || null,
    linked_at: parseInt(data.linked_at!),
    status: data.status as 'linked' | 'unlinked'
  };
}

export async function getLastChat(redis: Redis, telegramUserId: string): Promise<string | null> {
  const key = `last_chat:${telegramUserId}`;
  return await redis.get(key);
}
