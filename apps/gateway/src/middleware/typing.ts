import type { NextFunction } from 'grammy';
import type { BotContext } from '../bot/context.js';

/**
 * Middleware that sends a "typing" indicator while the next handler runs.
 * Re-sends the indicator every 4 seconds to keep it alive for long operations.
 */
export async function typingMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  // Only send typing for text messages and callback queries
  if (!ctx.chat || (!ctx.message?.text && !ctx.callbackQuery)) {
    return next();
  }

  let active = true;

  const sendTyping = async () => {
    while (active) {
      try {
        await ctx.replyWithChatAction('typing');
      } catch {
        // Ignore errors (e.g. chat not found)
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  };

  // Start typing in background
  const typingPromise = sendTyping();

  try {
    await next();
  } finally {
    active = false;
    // Let the typing loop finish its current iteration
    await typingPromise.catch(() => {});
  }
}
