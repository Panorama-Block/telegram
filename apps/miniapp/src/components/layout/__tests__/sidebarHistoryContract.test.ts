import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('sidebar chat history contract', () => {
  const shell = read('components/layout/SeniorAppShell.tsx');

  test('sidebar history is permanent and not controlled by the demo feature flag', () => {
    expect(shell).not.toContain('FEATURE_FLAGS.CHAT_HISTORY_ENABLED');
    expect(shell).toContain('Recent Chats');
  });

  test('sidebar uses backend conversation titles without browser-local overrides', () => {
    expect(shell).not.toContain('chat:aiTitle:');
    expect(shell).not.toContain('deriveConversationTitleFromCache');
    expect(shell).not.toContain('resolveConversationTitle');
  });

  test('sidebar history is sourced from ChatContext', () => {
    expect(shell).toContain('conversations,');
    expect(shell).toContain('activeConversationId,');
    expect(shell).toContain('deleteConversation,');
    expect(shell).toContain('} = useChat();');
  });

  test('selecting history navigates using the logical conversation ID', () => {
    expect(shell).toContain(
      'router.push(`/chat?conversation_id=${conversationId}`)'
    );
    expect(shell).toContain(
      'router.replace(`/chat?conversation_id=${conversationId}`)'
    );
  });

  test('sidebar renders the conversation title supplied by ChatContext', () => {
    expect(shell).toContain(
      '<span className="truncate">{conversation.title || \'Chat\'}</span>'
    );
  });
});
