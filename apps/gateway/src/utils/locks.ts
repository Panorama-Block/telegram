import type { Redis } from 'ioredis';

/**
 * Implementa lock distribuído usando Redis para evitar processamento duplicado
 * de mensagens do mesmo chat
 */
export class ChatLock {
  private redis: Redis;
  private ttl: number;

  constructor(redis: Redis, ttlSeconds = 60) {
    this.redis = redis;
    this.ttl = ttlSeconds;
  }

  private lockKey(chatId: number): string {
    return `lock:chat:${chatId}`;
  }

  async acquire(chatId: number): Promise<boolean> {
    const key = this.lockKey(chatId);
    const result = await this.redis.set(key, '1', 'EX', this.ttl, 'NX');
    return result === 'OK';
  }

  async release(chatId: number): Promise<void> {
    const key = this.lockKey(chatId);
    await this.redis.del(key);
  }

  async withLock<T>(chatId: number, fn: () => Promise<T>): Promise<T | null> {
    const acquired = await this.acquire(chatId);
    if (!acquired) {
      return null; // Lock não adquirido, operação em andamento
    }

    try {
      return await fn();
    } finally {
      await this.release(chatId);
    }
  }
}
