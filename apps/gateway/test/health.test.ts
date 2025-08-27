import { describe, it, expect } from 'vitest';

import { createServer } from '../src/server';

describe('health endpoint', () => {
  it('GET /healthz returns ok', async () => {
    process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'dummy';
    process.env.TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? 'secret';
    const app = await createServer();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toEqual({ status: 'ok' });
  });
});


