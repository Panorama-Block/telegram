import { afterEach, describe, expect, it, vi } from 'vitest';

describe('installTelegramWindowOpenShim', () => {
  const originalTelegram = (window as any).Telegram;
  const originalOpen = window.open;

  afterEach(() => {
    (window as any).Telegram = originalTelegram;
    window.open = originalOpen;
    vi.resetModules();
  });

  it('does not override window.open when Telegram.WebApp is injected outside a real mini app context', async () => {
    (window as any).Telegram = {
      WebApp: {
        version: '7.0',
        initData: '',
        openLink: vi.fn(),
        openTelegramLink: vi.fn(),
      },
    };

    const { installTelegramWindowOpenShim } = await import('../telegramWindowOpenShim');

    installTelegramWindowOpenShim();

    expect(window.open).toBe(originalOpen);
  });

  it("leaves generic https popups to the browser when running in a real Telegram mini app context", async () => {
    const openLink = vi.fn();
    const popup = {} as Window;
    const nativeOpenSpy = vi.fn(() => popup);
    window.open = nativeOpenSpy;
    (window as any).Telegram = {
      WebApp: {
        version: "7.0",
        initData: "query_id=test",
        openLink,
        openTelegramLink: vi.fn(),
      },
    };

    const { installTelegramWindowOpenShim } = await import("../telegramWindowOpenShim");

    installTelegramWindowOpenShim();
    const result = window.open("https://accounts.google.com/o/oauth2/v2/auth", "_blank");

    expect(result).toBe(popup);
    expect(openLink).not.toHaveBeenCalled();
    expect(nativeOpenSpy).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/v2/auth",
      "_blank",
      undefined,
    );
  });
});
