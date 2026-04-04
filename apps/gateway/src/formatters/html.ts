const TELEGRAM_MAX_MESSAGE_LEN = 3900;

/** Escape characters that break Telegram HTML parse mode. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert markdown-ish agent response to Telegram HTML.
 *
 * Supports: bold, italic, code, pre, links, headings, bullets.
 * Strips unsupported markdown gracefully.
 */
export function formatForTelegramHtml(input: string): string {
  let text = (input || '').replace(/\r\n/g, '\n');

  // Extract fenced code blocks before escaping (preserve content)
  const codeBlocks: string[] = [];
  text = text.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_m, code: string) => {
    const idx = codeBlocks.length;
    codeBlocks.push(escapeHtml(code.trimEnd()));
    return `\x00CODEBLOCK_${idx}\x00`;
  });

  // Extract inline code before escaping
  const inlineCode: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_m, inner: string) => {
    const idx = inlineCode.length;
    inlineCode.push(escapeHtml(inner));
    return `\x00INLINE_${idx}\x00`;
  });

  // Now escape HTML in the rest of the text
  text = escapeHtml(text);

  // Restore code blocks as <pre>
  text = text.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_m, idx: string) => {
    return `<pre>${codeBlocks[parseInt(idx)]}</pre>`;
  });

  // Restore inline code as <code>
  text = text.replace(/\x00INLINE_(\d+)\x00/g, (_m, idx: string) => {
    return `<code>${inlineCode[parseInt(idx)]}</code>`;
  });

  // Markdown links [text](url) -> <a>
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2">$1</a>',
  );

  // Headings -> bold uppercase
  text = text.replace(/^#{1,6}\s+(.+)$/gm, (_m, title: string) =>
    `<b>${title.toUpperCase()}</b>`,
  );

  // Bold **text** or __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  text = text.replace(/__([^_]+)__/g, '<b>$1</b>');

  // Italic *text* or _text_
  text = text.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  text = text.replace(/_([^_]+)_/g, '<i>$1</i>');

  // Strikethrough ~~text~~
  text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');

  // Bullets
  text = text.replace(/^\s*[-*+]\s+/gm, '• ');

  // Ordered lists normalize
  text = text.replace(/^\s*(\d+)\.\s+/gm, '$1. ');

  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Split a message into Telegram-safe chunks.
 * Tries to split at newlines, then spaces, then hard-cuts.
 */
export function chunkMessage(input: string, maxLen = TELEGRAM_MAX_MESSAGE_LEN): string[] {
  const text = (input || '').trim();
  if (!text) return [''];
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < Math.floor(maxLen * 0.6)) {
      cut = remaining.lastIndexOf(' ', maxLen);
    }
    if (cut < Math.floor(maxLen * 0.4)) {
      cut = maxLen;
    }
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
