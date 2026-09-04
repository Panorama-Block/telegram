import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('home chat history contract', () => {
  const home = read('home/page.tsx');

  test('Home does not depend on the chat history feature flag', () => {
    expect(home).not.toContain('CHAT_HISTORY_ENABLED');
    expect(home).not.toContain("import { FEATURE_FLAGS } from '@/config/features'");
  });

  test('Home does not own conversation history state or loading', () => {
    expect(home).not.toContain('setConversations');
    expect(home).not.toContain('listConversations');
    expect(home).not.toContain('loading conversations');
  });

  test('Home does not render a recent conversations history surface', () => {
    expect(home).not.toContain('Recent Conversations');
    expect(home).not.toContain('conversations.map');
    expect(home).not.toContain('handleContinueChat');
  });

  test('Home does not reconstruct conversation titles from browser-local state', () => {
    expect(home).not.toContain('resolveConversationTitle');
    expect(home).not.toContain('chat:aiTitle:');
    expect(home).not.toContain('chat:cache:');
  });

  test('Home still allows starting a fresh chat', () => {
    expect(home).toContain("router.push('/chat?new=true')");
    expect(home).toContain('Start New Chat');
  });
});
