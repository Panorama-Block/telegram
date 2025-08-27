import { describe, it, expect, vi } from 'vitest';

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

describe('POST /auth/telegram/verify', () => {
  it('valida com sucesso initData correto', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'dummy_token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS = '600';
    process.env.AUTH_API_BASE = 'https://auth.example.com';
    const jwt =
      'aaa.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.bbb';
    vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ jwt, userId: 'user-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const user = { id: 123, username: 'alice', language_code: 'pt' };
    const authDate = Math.floor(Date.now() / 1000);
    const initData = buildInitData('dummy_token', user, authDate);

    const app = await createServer();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/telegram/verify',
      payload: { initData },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.telegram_user_id).toBe(123);
    expect(json.username).toBe('alice');
    expect(json.language_code).toBe('pt');
    expect(json.valid).toBe(true);
  });

  it('rejeita initData expirado', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'dummy_token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS = '1';

    const user = { id: 456 };
    const authDate = Math.floor(Date.now() / 1000) - 10;
    const initData = buildInitData('dummy_token', user, authDate);

    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/auth/telegram/verify', payload: { initData } });
    expect(res.statusCode).toBe(401);
  });

  it('rejeita hash inválido', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'dummy_token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS = '600';

    const user = { id: 789 };
    const authDate = Math.floor(Date.now() / 1000);
    const bad = new URLSearchParams({ auth_date: String(authDate), query_id: 'q', user: encodeURIComponent(JSON.stringify(user)), hash: 'deadbeef' });

    const app = await createServer();
    const res = await app.inject({ method: 'POST', url: '/auth/telegram/verify', payload: { initData: bad.toString() } });
    expect(res.statusCode).toBe(401);
  });
});


