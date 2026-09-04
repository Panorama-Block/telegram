import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), 'utf8');
}

describe('truthful chat deletion contract', () => {
  const context = read('shared/contexts/ChatContext.tsx');
  const client = read('clients/agentsClient.ts');

  test('client throws when durable deletion returns non-success HTTP', () => {
    expect(client).toContain('if (!res.ok)');
    expect(client).toContain('throw new Error(`Agents delete conversation failed:');
  });

  test('ChatContext waits for durable delete before removing local state', () => {
    const awaitDelete = context.indexOf(
      'await agentsClient.deleteConversation(userId, conversationId, authOpts)'
    );
    const localRemoval = context.indexOf(
      'setConversations(prev => prev.filter(c => c.id !== conversationId))'
    );

    expect(awaitDelete).toBeGreaterThan(-1);
    expect(localRemoval).toBeGreaterThan(awaitDelete);
  });

  test('failed deletion does not remove the conversation in the catch path', () => {
    const catchStart = context.indexOf(
      "} catch (err) {\n      console.error('Error deleting conversation:', err);"
    );

    expect(catchStart).toBeGreaterThan(-1);

    const catchEnd = context.indexOf(
      '\n    }\n  },',
      catchStart
    );

    expect(catchEnd).toBeGreaterThan(catchStart);

    const catchBody = context.slice(catchStart, catchEnd);

    expect(catchBody).not.toContain('setConversations');
    expect(catchBody).not.toContain('setActiveConversationId(null)');
  });
});
