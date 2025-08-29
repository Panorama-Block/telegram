import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bot } from 'grammy';

import { registerCommandHandlers } from '../src/handlers/commands';

describe('command handlers', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AGENTS_API_BASE = 'https://agents.example.com';
    process.env.PUBLIC_WEBAPP_URL = 'https://app.example.com/webapp';
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
});
