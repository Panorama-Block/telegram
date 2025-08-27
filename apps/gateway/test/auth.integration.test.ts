import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createServer } from '../src/server';
import { computeHmacHex, deriveSecretKey } from '../src/utils/telegramInitData';

function buildInitData(botToken: string, user: object, authDate: number) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'test');
  params.set('user', encodeURIComponent(JSON.stringify(user)));
  const pairs = Array.from(params.keys())
    .sort()
    .map((k) => `${k}=${params.get(k)}`)
    .join('\n');
  const secret = deriveSecretKey(botToken);
  const hash = computeHmacHex(secret, pairs);
  params.set('hash', hash);
  return params.toString();
}

describe('Auth integration (register/exchange)', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'dummy_token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS = '600';
    process.env.NODE_ENV = 'test';
  });

  it('exchange ok quando disponível', async () => {
    // Mock global fetch para exchange
    const jwt =
      'aaa.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.bbb';
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ jwt, userId: 'user-1' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    process.env.AUTH_API_BASE = 'https://auth.example.com';
    const user = { id: 321, username: 'bob', language_code: 'en' };
    const initData = buildInitData('dummy_token', user, Math.floor(Date.now() / 1000));

    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/auth/telegram/verify', payload: { initData } });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.zico_user_id).toBe('user-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fallback para register quando exchange falha', async () => {
    const jwt =
      'aaa.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.bbb';
    const fetchMock = vi
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jwt, userId: 'user-2' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    process.env.AUTH_API_BASE = 'https://auth.example.com';
    const user = { id: 654 };
    const initData = buildInitData('dummy_token', user, Math.floor(Date.now() / 1000));

    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/auth/telegram/verify', payload: { initData } });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.zico_user_id).toBe('user-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});


