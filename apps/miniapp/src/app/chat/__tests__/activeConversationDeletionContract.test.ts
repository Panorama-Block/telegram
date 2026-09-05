import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), 'utf8');
}

describe('active conversation deletion contract', () => {
  const chatPage = read('app/chat/page.tsx');
  const chatContext = read('shared/contexts/ChatContext.tsx');
  const shell = read('components/layout/SeniorAppShell.tsx');

  test('successful durable deletion is published to the chat page', () => {
    expect(chatContext).toContain(
      "window.dispatchEvent(new CustomEvent('panorama:conversationdeleted'"
    );

    expect(chatPage).toContain(
      "window.addEventListener('panorama:conversationdeleted'"
    );

    expect(chatPage).toContain(
      "window.removeEventListener('panorama:conversationdeleted'"
    );
  });

  test('sidebar waits for durable deletion instead of fire-and-forget', () => {
    expect(shell).toContain(
      'await deleteConversation(conversationId)'
    );
  });

  test('deleted conversation is removed from page-owned message state', () => {
    expect(chatPage).toContain(
      'delete next[conversationId]'
    );
  });

  test('deleted conversation message cache is removed', () => {
    expect(chatPage).toContain(
      'localStorage.removeItem(buildMessageCacheKey(userId, conversationId))'
    );
  });

  test('deleted conversation is removed from cached conversation IDs', () => {
    expect(chatPage).toContain(
      'const remainingIds = loadCachedConversationIds(userId)'
    );
    expect(chatPage).toContain(
      '.filter((id) => id !== conversationId)'
    );

    expect(chatPage).toContain(
      'localStorage.setItem('
    );
    expect(chatPage).toContain(
      '`${CONVERSATION_LIST_KEY}:${userId}`'
    );
    expect(chatPage).toContain(
      'JSON.stringify(remainingIds)'
    );
  });

  test('clearing active conversation clears the persisted last-conversation pointer', () => {
    const start = chatPage.indexOf('const setActiveConversation = useCallback');
    const end = chatPage.indexOf('const loadConversationMessages', start);
    const setActiveConversationBlock = chatPage.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(setActiveConversationBlock).toContain(
      'localStorage.removeItem(LAST_CONVERSATION_STORAGE_KEY)'
    );
  });

  test('deleting the currently active conversation enters clean new-chat state', () => {
    expect(chatPage).toContain(
      'if (activeConversationId === conversationId)'
    );

    expect(chatPage).toContain(
      'setPendingNewChat(true)'
    );

    expect(chatPage).toContain(
      'setActiveConversation(null)'
    );

    expect(chatPage).toContain(
      "router.replace('/chat', { scroll: false })"
    );
  });
});
