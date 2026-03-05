import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TelegramIdentityClient } from '../src/clients/telegramIdentityClient';

describe('TelegramIdentityClient', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'dummy';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.AUTH_API_BASE = 'https://auth.example.com';
  });

  it('returns mapped user when found', async () => {
    vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          telegram_user_id: '555',
          zico_user_id: '0xabc',
          found: true,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new TelegramIdentityClient();
    const result = await client.resolveUserId('555');
    expect(result.found).toBe(true);
    expect(result.zico_user_id).toBe('0xabc');
  });

  it('returns not-found result when mapping is absent', async () => {
    vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          telegram_user_id: '555',
          found: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new TelegramIdentityClient();
    const result = await client.resolveUserId('555');
    expect(result.found).toBe(false);
    expect(result.telegram_user_id).toBe('555');
  });
});
