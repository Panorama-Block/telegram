import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentsClient } from '../src/clients/agentsClient';

describe('chat proxy (unit)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'dummy';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.AGENTS_API_BASE = 'https://agents.example.com';
  });

  it('AgentsClient calls /chat with expected payload', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ response: 'Olá do Zico!' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new AgentsClient();
    const res = await client.chat({
      user_id: '555',
      conversation_id: 'tgchat:123',
      message: { role: 'user', content: 'quanto está o btc?' },
      metadata: { channel: 'telegram' },
    });

    expect(res.message).toBe('Olá do Zico!');
    // Validate endpoint, method and key fields in body
    const call = (fetchMock.mock.calls?.[0] ?? []) as any[];
    expect(call[0]).toBe('https://agents.example.com/chat');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['content-type']).toBe('application/json');
    const sent = JSON.parse(call[1].body);
    expect(sent.user_id).toBe('555');
    expect(sent.conversation_id).toBe('tgchat:123');
    expect(sent.message).toEqual({ role: 'user', content: 'quanto está o btc?' });
    expect(sent.metadata).toEqual({ channel: 'telegram' });
  });

  it('coerces message from messages array and exposes metadata', async () => {
    vi.spyOn(global, 'fetch' as any).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          messages: [
            { role: 'assistant', content: 'assistente final' },
          ],
          metadata: { event: 'swap_intent_ready' },
          agentName: 'token swap',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const client = new AgentsClient();
    const res = await client.chat({
      user_id: '555',
      conversation_id: 'tgchat:123',
      message: { role: 'user', content: 'swap 1 usdc to avax' },
    });

    expect(res.message).toBe('assistente final');
    expect(res.metadata).toEqual({ event: 'swap_intent_ready' });
    expect(res.agent_name).toBe('token swap');
  });
});
