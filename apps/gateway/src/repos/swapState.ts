import type { Redis } from 'ioredis';

export type SwapStep = 'choose_chain' | 'choose_token_in' | 'choose_token_out' | 'enter_amount' | 'confirm_quote';

export interface SwapState {
  step: SwapStep;
  chain?: string;
  token_in?: string;
  token_out?: string;
  amount?: number;
}

const key = (chatId: number) => `swap:state:tg:${chatId}`;

export async function getSwapState(redis: Redis, chatId: number): Promise<SwapState | null> {
  const raw = await redis.get(key(chatId));
  return raw ? (JSON.parse(raw) as SwapState) : null;
}

export async function setSwapState(redis: Redis, chatId: number, state: SwapState): Promise<void> {
  // TTL curto (15 min)
  await redis.set(key(chatId), JSON.stringify(state), 'EX', 15 * 60);
}

export async function clearSwapState(redis: Redis, chatId: number): Promise<void> {
  await redis.del(key(chatId));
}

