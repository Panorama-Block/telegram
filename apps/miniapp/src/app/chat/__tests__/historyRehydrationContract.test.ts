import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('chat history rehydration contract', () => {
  const chatPage = read('app/chat/page.tsx');
  const shell = read('components/layout/SeniorAppShell.tsx');
  const authGuard = read('shared/ui/AuthGuard.tsx');

  test('history selection navigates using the logical conversation_id', () => {
    expect(shell).toContain(
      'router.push(`/chat?conversation_id=${conversationId}`)'
    );
    expect(shell).toContain(
      'router.replace(`/chat?conversation_id=${conversationId}`)'
    );
  });

  test('requested historic conversation becomes the active conversation', () => {
    expect(chatPage).toContain(
      "const requestedConversationId = searchParams.get('conversation_id')"
    );
    expect(chatPage).toContain(
      'conversation.id === requestedConversationId'
    );
    expect(chatPage).toContain(
      'targetConversationId = requestedConversation.id'
    );
    expect(chatPage).toContain(
      'setActiveConversation(targetConversationId)'
    );
  });

  test('active historic conversation loads its messages from the backend', () => {
    expect(chatPage).toContain(
      'loadConversationMessages(activeConversationId)'
    );
    expect(chatPage).toContain(
      'agentsClient.fetchMessages(userId, conversationId, authOpts)'
    );
  });

  test('chat page does not add a second independent authentication gate', () => {
    expect(chatPage).not.toContain('<ProtectedRoute>');
    expect(chatPage).not.toContain('</ProtectedRoute>');
  });

  test('global auth guard is the route-level authentication authority', () => {
    expect(authGuard).toContain('canAccessProtectedRoute');
    expect(authGuard).toContain("router.push('/newchat')");
  });

  test('selecting an existing conversation exits new-chat mode before continuation', () => {
    expect(chatPage).toContain(
      'setPendingNewChat(false);'
    );
    expect(chatPage).toContain(
      'setActiveConversation(conversationId);'
    );
  });

  test('sending in an active conversation reuses its conversation_id', () => {
    expect(chatPage).toContain(
      'let conversationId = activeConversationId;'
    );
    expect(chatPage).toContain(
      'if (pendingNewChat || !conversationId)'
    );
    expect(chatPage).toContain(
      'conversationId,'
    );
    expect(chatPage).toContain(
      'sendStream({'
    );
  });
});
