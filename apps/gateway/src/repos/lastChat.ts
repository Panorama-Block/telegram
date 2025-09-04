import type { Redis } from 'ioredis';

const key = (telegramUserId: number) => `tg:last_chat:${telegramUserId}`;

export async function saveLastChat(redis: Redis, telegramUserId: number, chatId: number): Promise<void> {
  // TTL 30 days; refreshed on each interaction
  await redis.set(key(telegramUserId), String(chatId), 'EX', 30 * 24 * 60 * 60);
}

export async function getLastChat(redis: Redis, telegramUserId: number): Promise<number | null> {
  const val = await redis.get(key(telegramUserId));
  return val ? Number(val) : null;
}

