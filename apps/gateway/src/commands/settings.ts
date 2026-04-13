import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot/context.js';
import { t } from '../i18n/index.js';

export async function handleSettings(ctx: BotContext): Promise<void> {
  const strings = t(ctx.session.language);

  const keyboard = new InlineKeyboard()
    .text(strings.btn_lang_en, 'lang_en')
    .text(strings.btn_lang_pt, 'lang_pt')
    .row()
    .text(strings.btn_back, 'open_menu');

  const currentLang = ctx.session.language === 'pt' ? '🇧🇷 Português' : '🇺🇸 English';

  await ctx.reply(
    `${strings.settings_title}\n\n${strings.settings_language}: ${currentLang}`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}
