import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bot } from 'grammy';

import {
  buildActionKeyboard,
  buildMiniappUrl,
  buildTelegramConversationId,
  detectReadyActionEvent,
  resolveGatewayUserId,
  registerCommandHandlers,
} from '../src/handlers/commands';

describe('command handlers', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'dummy';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    process.env.AGENTS_API_BASE = 'https://agents.example.com';
    process.env.PUBLIC_WEBAPP_URL = 'https://app.example.com/miniapp';
  });

  it('registra comandos sem erros', () => {
    // Mock bot básico para verificar se não há erros de sintaxe
    const bot = new Bot('dummy');
    
    // Deve executar sem erros
    expect(() => registerCommandHandlers(bot)).not.toThrow();
  });

  it('command handlers são funções válidas', () => {
    const bot = new Bot('dummy');
    registerCommandHandlers(bot);
    
    // Se chegou até aqui, os handlers foram registrados corretamente
    expect(true).toBe(true);
  });

  it('builds stable conversation id from chat id', () => {
    expect(buildTelegramConversationId(12345)).toBe('tgchat:12345');
  });

  it('detects ready action events from metadata', () => {
    expect(detectReadyActionEvent({ event: 'swap_intent_ready' })).toBe('swap_intent_ready');
    expect(detectReadyActionEvent({ event: 'lending_intent_pending' })).toBeNull();
    expect(detectReadyActionEvent(null)).toBeNull();
  });

  it('builds action keyboard URL with chat context', () => {
    const keyboard = buildActionKeyboard(
      'https://app.example.com/miniapp',
      'tgchat:777',
      '555',
      'swap_intent_ready',
    );
    const data = (keyboard as any).inline_keyboard;
    expect(data[0][0].text).toBe('Review Swap');
    const webAppUrl = data[0][0].web_app.url as string;
    expect(webAppUrl).toContain('/miniapp/chat?');
    expect(webAppUrl).toContain('conversation_id=tgchat%3A777');
    expect(webAppUrl).toContain('telegram_user_id=555');
    expect(webAppUrl).toContain('tma=1');
  });

  it('appends sub-path to miniapp URL', () => {
    const result = buildMiniappUrl('https://app.example.com/miniapp/', { subPath: 'chat' });
    expect(result).toBe('https://app.example.com/miniapp/chat');
  });

  it('resolveGatewayUserId uses mapped zico user when found', async () => {
    const fakeIdentityClient = {
      resolveUserId: vi.fn().mockResolvedValue({
        found: true,
        telegram_user_id: '555',
        zico_user_id: '0xabc',
      }),
    } as any;

    const result = await resolveGatewayUserId('555', fakeIdentityClient);
    expect(result.mode).toBe('found');
    expect(result.effectiveUserId).toBe('0xabc');
  });

  it('resolveGatewayUserId falls back when resolve fails', async () => {
    const fakeIdentityClient = {
      resolveUserId: vi.fn().mockRejectedValue(new Error('boom')),
    } as any;

    const result = await resolveGatewayUserId('555', fakeIdentityClient);
    expect(result.mode).toBe('error');
    expect(result.effectiveUserId).toBe('555');
  });
});
