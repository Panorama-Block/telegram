import Redis, { type Redis as IORedis } from 'ioredis';
import { parseEnv } from '../env.js';
import Mock from 'ioredis-mock';

let client: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (client) return client;
  
  // TODO: Remover ioredis-mock
  client = new Mock();
  return client as unknown as IORedis;
}