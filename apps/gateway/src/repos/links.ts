import type { Redis } from 'ioredis';

export interface TelegramLink {
  telegram_user_id: number;
  zico_user_id: string;
  username?: string | null;
  language_code?: string | null;
  linked_at: number; // epoch seconds
  status: 'linked' | 'unlinked';
}

const keyLink = (telegramUserId: number) => `tg:link:${telegramUserId}`;

export async function saveLink(redis: Redis, link: TelegramLink): Promise<void> {
  const k = keyLink(link.telegram_user_id);
  await redis.set(k, JSON.stringify(link));
}

export async function getLink(redis: Redis, telegramUserId: number): Promise<TelegramLink | null> {
  const k = keyLink(telegramUserId);
  const raw = await redis.get(k);
  return raw ? (JSON.parse(raw) as TelegramLink) : null;
}


