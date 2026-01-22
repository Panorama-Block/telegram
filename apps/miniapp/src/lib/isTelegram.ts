export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;

  const tg = (window as any).Telegram;
  const webApp = tg?.WebApp;

  // 1) Strongest signal: official Telegram WebApp context
  if (webApp && typeof webApp.initData === 'string' && webApp.initData.length > 0) {
    return true;
  }

  // 2) Telegram injects tgWebApp* params in URL
  const search = window.location?.search ?? '';
  if (/tgWebApp/i.test(search)) {
    return true;
  }

  // 3) Telegram Web (browser) – only if you're on Telegram's web host
  const host = window.location.hostname.toLowerCase();
  if (/^web\.telegram\.(org|me)$/i.test(host)) {
    return true;
  }

  // 4) Telegram WebApp inside Telegram Web iframe (initData can be empty)
  if (webApp && tg?.WebView?.isIframe === true && typeof webApp.version === 'string') {
    return true;
  }

  // 5) Telegram Web/Desktop can expose WebApp but omit initData unless launched via bot
  const ua = navigator?.userAgent ?? '';
  const platform = typeof webApp?.platform === 'string' ? webApp.platform : '';
  const knownPlatforms = new Set(['android', 'ios', 'tdesktop', 'web', 'webk', 'webz', 'macos']);
  if (webApp && knownPlatforms.has(platform) && /Telegram/i.test(ua)) {
    return true;
  }

  return false;
}
