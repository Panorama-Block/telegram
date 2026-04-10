import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';

export async function handleHelp(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);
  await ctx.reply(`${strings.help_title}\n\n${strings.help_body}`, { parse_mode: 'HTML' });
}
