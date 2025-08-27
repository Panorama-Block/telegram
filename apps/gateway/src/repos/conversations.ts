import type { Redis } from 'ioredis';

const keyConv = (chatId: number) => `conv:tg:${chatId}`;

export async function getConversationId(redis: Redis, chatId: number): Promise<string | null> {
  return (await redis.get(keyConv(chatId))) as string | null;
}

export async function setConversationId(redis: Redis, chatId: number, conversationId: string): Promise<void> {
  await redis.set(keyConv(chatId), conversationId);
}


