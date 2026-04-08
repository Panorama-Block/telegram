import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';

/**
 * Error boundary middleware.
 * Catches errors from downstream handlers and sends user-friendly messages.
 * Logs structured error data for debugging.
 */
export async function errorBoundaryMiddleware(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  try {
    await next();
  } catch (error) {
    const errorInfo = {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      updateType: ctx.update ? Object.keys(ctx.update).filter((k) => k !== 'update_id').join(',') : 'unknown',
      messageText: ctx.message?.text?.slice(0, 50),
      callbackData: ctx.callbackQuery?.data,
      timestamp: new Date().toISOString(),
    };

    console.error('[ErrorBoundary]', JSON.stringify(errorInfo));

    // Attempt to notify user
    try {
      const strings = t(ctx.session?.language ?? 'en');
      await ctx.reply(strings.error_generic, { parse_mode: 'HTML' });
    } catch {
      // If we can't even reply, silently fail
    }
  }
}
