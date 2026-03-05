const TELEGRAM_MAX_MESSAGE_LEN = 3900;

export function formatForTelegram(input: string): string {
  let text = (input || '').replace(/\r\n/g, '\n');

  // fenced code blocks -> indented plain text
  text = text.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_m, code: string) => {
    const normalized = String(code || '')
      .trimEnd()
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    return `\n${normalized}\n`;
  });

  // inline code -> quoted
  text = text.replace(/`([^`]+)`/g, (_m, inner: string) => `"${inner}"`);

  // markdown links [text](url) -> text (url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)');

  // headings
  text = text.replace(/^#{1,6}\s+(.+)$/gm, (_m, title: string) => title.toUpperCase());

  // bullets
  text = text.replace(/^\s*[-*+]\s+/gm, '• ');

  // ordered lists normalize spacing
  text = text.replace(/^\s*(\d+)\.\s+/gm, '$1. ');

  // bold/italic/strike markdown removal (keep text)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // collapse excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

export function chunkTelegramText(input: string, maxLen: number = TELEGRAM_MAX_MESSAGE_LEN): string[] {
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
