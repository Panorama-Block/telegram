import Redis, { type Redis as IORedis } from 'ioredis';
import { parseEnv } from '../env.js';

let client: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (client) return client;
  const env = parseEnv();
  if (process.env['NODE_ENV'] === 'test') {
    // Usar ioredis-mock em testes
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Mock = require('ioredis-mock');
    client = new Mock();
    return client as unknown as IORedis;
  }
  const url = env.REDIS_URL;
  client = url ? new Redis(url) : new Redis();
  return client;
}


