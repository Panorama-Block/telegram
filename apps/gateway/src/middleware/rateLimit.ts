import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';

const userBuckets = new Map<number, { count: number; resetAt: number }>();

const MAX_MESSAGES_PER_WINDOW = 20;
const WINDOW_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes

// Periodic cleanup of expired buckets
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of userBuckets) {
    if (now > bucket.resetAt) userBuckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Per-user rate limiting middleware.
 * Limits message frequency to prevent abuse and API overload.
 */
export async function rateLimitMiddleware(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  let bucket = userBuckets.get(userId);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    userBuckets.set(userId, bucket);
  }

  bucket.count++;

  if (bucket.count > MAX_MESSAGES_PER_WINDOW) {
    const strings = t(ctx.session?.language ?? 'en');
    const secsLeft = Math.ceil((bucket.resetAt - now) / 1000);
    await ctx.reply(
      `⏱️ ${strings.rate_limited ?? `Too many messages. Please wait ${secsLeft}s.`}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  return next();
}
