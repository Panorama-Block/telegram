import { en, type I18nStrings } from './en.js';
import { pt } from './pt.js';

const locales: Record<string, I18nStrings> = { en, pt };

export function t(lang: string): I18nStrings {
  return locales[lang] ?? en;
}

export function detectLanguage(telegramLangCode?: string): 'en' | 'pt' {
  if (!telegramLangCode) return 'en';
  const code = telegramLangCode.toLowerCase();
  if (code === 'pt' || code.startsWith('pt-') || code.startsWith('pt_')) return 'pt';
  return 'en';
}

export type { I18nStrings };
