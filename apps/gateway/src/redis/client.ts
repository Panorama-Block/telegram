import { getRedis } from '../bot/session.js';

/**
 * Get the shared Redis client instance.
 * Re-exports from bot/session.ts to maintain backwards compatibility
 * with metrics and health routes.
 */
export function getRedisClient(): ReturnType<typeof getRedis> {
  return getRedis();
}
