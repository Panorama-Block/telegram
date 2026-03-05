import { describe, expect, it } from 'vitest';

import { chunkTelegramText, formatForTelegram } from '../src/utils/telegramText';

describe('telegramText utils', () => {
  it('normalizes common markdown to plain text', () => {
    const input = [
      '# Title',
      '',
      '- item one',
      '- item two',
      '',
      'Use `code` and [link](https://example.com)',
      '',
      '```ts',
      'const x = 1;',
      '```',
    ].join('\n');

    const output = formatForTelegram(input);
    expect(output).toContain('TITLE');
    expect(output).toContain('• item one');
    expect(output).toContain('"code"');
    expect(output).toContain('link (https://example.com)');
    expect(output).toContain('  const x = 1;');
  });

  it('chunks long text preserving content', () => {
    const input = `A ${'x'.repeat(5000)} B`;
    const chunks = chunkTelegramText(input, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('A');
    expect(chunks.join(' ')).toContain('B');
  });
});
