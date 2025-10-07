import { describe, it, expect } from 'vitest';
import { buildStartMenu, getHelpText, getOnboardingPages, getOnboardingPageById, buildOnboardingKeyboard, getLongWelcomeText } from '../src/utils/onboarding';

describe('onboarding helpers', () => {
  it('builds start menu with link callback (chat-only)', () => {
    const env: any = {
      TELEGRAM_BOT_TOKEN: 'dummy',
      TELEGRAM_WEBHOOK_SECRET: 'secret',
      PUBLIC_WEBAPP_URL: 'https://ignored.example.com/webapp',
    };
    const kb = buildStartMenu(env);
    expect(kb.inline_keyboard[0][0].text).toContain('Link Account');
    expect(kb.inline_keyboard[0][0].callback_data).toBe('link');
  });

  it('help text lists main commands', () => {
    const help = getHelpText();
    expect(help).toContain('/start');
    expect(help).toContain('/help');
    expect(help).toContain('/settings');
    expect(help).toContain('/status');
    expect(help).toContain('/swap');
    expect(help).toContain('/link');
    expect(help).toContain('/unlink');
  });

  it('has onboarding pages with navigation', () => {
    const pages = getOnboardingPages();
    expect(pages.length).toBeGreaterThanOrEqual(5);
    const p1 = getOnboardingPageById(1)!;
    expect(p1.page.title.length).toBeGreaterThan(0);
    const kb = buildOnboardingKeyboard({} as any, 1);
    expect(kb.inline_keyboard[0].length).toBe(3); // prev / idx / next
    // Has Link Account callback
    expect(kb.inline_keyboard[1][0].callback_data).toBe('link');
  });

  it('long welcome text is descriptive', () => {
    const t = getLongWelcomeText();
    expect(t).toContain('Welcome to Zico Agent');
    expect(t).toContain('crypto copilot');
    expect(t.toLowerCase()).toContain('link your account');
  });
});
