import type { Redis } from 'ioredis';

const key = (chatId: number) => `track:tg:${chatId}`;

export async function addTracked(redis: Redis, chatId: number, address: string): Promise<void> {
  await redis.sadd(key(chatId), address.toLowerCase());
}

export async function removeTracked(redis: Redis, chatId: number, address?: string): Promise<void> {
  if (address) {
    await redis.srem(key(chatId), address.toLowerCase());
  } else {
    await redis.del(key(chatId));
  }
}

export async function listTracked(redis: Redis, chatId: number): Promise<string[]> {
  const res = await redis.smembers(key(chatId));
  return (res ?? []).map((s) => s.toLowerCase()).sort();
}

