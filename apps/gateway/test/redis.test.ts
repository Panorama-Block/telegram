import { describe, it, expect } from 'vitest';

import { getRedisClient } from '../src/redis/client';
import { saveLink, getLink, type TelegramLink } from '../src/repos/links';
import { saveSession, getSession, type SessionRecord } from '../src/repos/sessions';

describe('redis repos', () => {
  it('save/get link', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'dummy';
    process.env.TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? 'secret';
    const r = getRedisClient();
    const link: TelegramLink = {
      telegram_user_id: 111,
      zico_user_id: 'user-abc',
      username: 'alice',
      language_code: 'pt',
      linked_at: Math.floor(Date.now() / 1000),
      status: 'linked',
    };
    await saveLink(r, link);
    const got = await getLink(r, 111);
    expect(got).not.toBeNull();
    expect(got?.zico_user_id).toBe('user-abc');
  });

  it('save/get session with ttl', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'dummy';
    process.env.TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? 'secret';
    const r = getRedisClient();
    const now = Math.floor(Date.now() / 1000);
    const rec: SessionRecord = {
      zico_user_id: 'user-xyz',
      channel: 'telegram',
      chat_id: 999,
      jwt: 'jwt-token',
      expires_at: now + 60,
    };
    await saveSession(r, rec);
    const got = await getSession(r, 'user-xyz', 999);
    expect(got?.jwt).toBe('jwt-token');
  });
});


