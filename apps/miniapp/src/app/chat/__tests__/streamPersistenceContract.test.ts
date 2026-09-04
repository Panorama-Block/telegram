import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('chat stream persistence contract', () => {
  const chatPage = read('app/chat/page.tsx');

  function completionBlock(): string {
    const completionStart = chatPage.indexOf(
      'if (streamDone && !typewriterRevealing && streamResult)'
    );

    const errorStart = chatPage.indexOf(
      'if (streamError)',
      completionStart
    );

    expect(completionStart).toBeGreaterThanOrEqual(0);
    expect(errorStart).toBeGreaterThan(completionStart);

    return chatPage.slice(completionStart, errorStart);
  }

  test('completed stream performs an authoritative backend reconciliation', () => {
    expect(completionBlock()).toContain(
      'loadConversationMessages(conversationId, { authoritative: true })'
    );
  });

  test('authoritative message loading does not fall back to browser cache', () => {
    expect(chatPage).toContain(
      'authoritative?: boolean'
    );

    expect(chatPage).toContain(
      'if (!options.authoritative)'
    );

    expect(chatPage).toContain(
      'options.authoritative ? mappedHistory'
    );
  });

  test('successful reconciliation starts before stream ownership is released', () => {
    const block = completionBlock();

    const reloadIndex = block.indexOf(
      'loadConversationMessages(conversationId, { authoritative: true })'
    );

    const releaseIndex = block.indexOf(
      'streamConversationRef.current = null'
    );

    expect(reloadIndex).toBeGreaterThanOrEqual(0);
    expect(releaseIndex).toBeGreaterThan(reloadIndex);
  });

  test('successful assistant materialisation uses done.response as authority', () => {
    const block = completionBlock();

    expect(block).toContain(
      "const responseText = streamResult.response || streamTokens || ''"
    );

    expect(block).toContain(
      'content: autoFormatAssistantMarkdown(responseText'
    );
  });

  test('authoritative reconciliation failures propagate instead of being swallowed', () => {
    expect(chatPage).toContain(
      'if (options.authoritative) throw error'
    );
  });

  test('durable completion is logged only after authoritative reconciliation succeeds', () => {
    const block = completionBlock();

    expect(block).toContain(
      '.then(() => {'
    );

    expect(block).toContain(
      "debug('chat:stream:complete', { conversationId })"
    );

    expect(block).toContain(
      '.catch((error) => {'
    );

    expect(block).toContain(
      "debug('chat:stream:reconciliation-error'"
    );
  });

  test('stream errors do not reconcile fallback UI messages as durable history', () => {
    const errorStart = chatPage.indexOf('if (streamError)');

    expect(errorStart).toBeGreaterThanOrEqual(0);

    const errorBlock = chatPage.slice(errorStart, errorStart + 1800);

    expect(errorBlock).not.toContain(
      'loadConversationMessages(conversationId'
    );
  });
});
