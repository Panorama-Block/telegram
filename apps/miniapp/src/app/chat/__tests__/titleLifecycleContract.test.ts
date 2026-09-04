import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('chat title lifecycle contract', () => {
  const chatPage = read('app/chat/page.tsx');
  const chatContext = read('shared/contexts/ChatContext.tsx');

  test('chat page does not persist AI titles in browser localStorage', () => {
    expect(chatPage).not.toContain('AI_TITLE_PREFIX');
    expect(chatPage).not.toContain(
      'localStorage.setItem(`${AI_TITLE_PREFIX}:${conversationId}`, aiTitle)'
    );
  });

  test('conversation list uses backend titles without local AI-title override', () => {
    expect(chatContext).not.toContain('chat:aiTitle:');
    expect(chatContext).not.toContain(
      'Prefer cached AI title over generic backend title'
    );
  });

  test('chat page does not derive competing conversation titles from messages', () => {
    expect(chatPage).not.toContain('function deriveConversationTitle(');
    expect(chatPage).not.toContain(
      'title: deriveConversationTitle(conversation.title, mappedHistory)'
    );
    expect(chatPage).not.toContain(
      'title: deriveConversationTitle(conversation.title, updatedMessages)'
    );
  });
});
