import Redis from 'ioredis';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { parseEnv } from '../env.js';
import type { SessionData } from './context.js';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (redisInstance) return redisInstance;

  const env = parseEnv();
  const url = env.REDIS_URL || 'redis://localhost:6379';

  redisInstance = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
  });

  redisInstance.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redisInstance.on('connect', () => {
    console.log('[Redis] Connected');
  });

  return redisInstance;
}

export function createSessionStorage(): RedisAdapter<SessionData> {
  const redis = getRedis();
  return new RedisAdapter<SessionData>({
    instance: redis,
    ttl: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
