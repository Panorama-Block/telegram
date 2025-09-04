import { describe, it, expect } from 'vitest';
import { buildStartMenu, getHelpText, getOnboardingPages, getOnboardingPageById, buildOnboardingKeyboard, getLongWelcomeText } from '../src/utils/onboarding';

describe('onboarding helpers', () => {
  it('builds start menu with web_app when configured', () => {
    const env: any = {
      TELEGRAM_BOT_TOKEN: 'dummy',
      TELEGRAM_WEBHOOK_SECRET: 'secret',
      PUBLIC_WEBAPP_URL: 'https://app.example.com/webapp',
    };
    const kb = buildStartMenu(env);
    // First row must be Link Account web_app
    expect(kb.inline_keyboard[0][0].text).toContain('Link Account');
    // @ts-expect-error dynamic field present at runtime
    expect(kb.inline_keyboard[0][0].web_app?.url).toBe('https://app.example.com/webapp');
  });

  it('builds start menu with link callback when webapp missing', () => {
    const env: any = {
      TELEGRAM_BOT_TOKEN: 'dummy',
      TELEGRAM_WEBHOOK_SECRET: 'secret',
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
    expect(p1.page.title).toContain('Zico');
    const kb = buildOnboardingKeyboard({ PUBLIC_WEBAPP_URL: 'https://app.example.com/webapp' } as any, 1);
    expect(kb.inline_keyboard[0].length).toBe(3); // prev / idx / next
    // Has Link Account with web_app
    // @ts-expect-error runtime only
    expect(kb.inline_keyboard[1][0].web_app?.url).toBe('https://app.example.com/webapp');
  });

  it('long welcome text is descriptive', () => {
    const t = getLongWelcomeText();
    expect(t).toContain('Welcome to Zico Agent');
    expect(t).toContain('crypto copilot');
    expect(t).toContain('Link your account');
  });
});
