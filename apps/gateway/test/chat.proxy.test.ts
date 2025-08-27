import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentsClient } from '../src/clients/agentsClient';

describe('chat proxy (unit)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'dummy';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.AGENTS_API_BASE = 'https://agents.example.com';
  });

  it('AgentsClient chama API corretamente', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Olá do Zico!' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new AgentsClient();
    const res = await client.chat({
      user_id: 'tg_user:555',
      conversation_id: 'tg:123',
      prompt: 'quanto está o btc?',
      metadata: { channel: 'telegram' },
    });

    expect(res.message).toBe('Olá do Zico!');
    expect(fetchMock).toHaveBeenCalledWith('https://agents.example.com/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user_id: 'tg_user:555',
        conversation_id: 'tg:123',
        prompt: 'quanto está o btc?',
        metadata: { channel: 'telegram' },
      }),
    });
  });
});


