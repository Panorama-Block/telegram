/**
 * Telegram Mini App window.open shim.
 *
 * Problem: Inside Telegram's iOS webview, window.open() is frequently blocked
 * or opens a non-functional tab. WalletConnect / Reown AppKit / Thirdweb's
 * wallet connectors call window.open(href, '_self') or similar to redirect
 * to wallet apps via deep links (wc:, metamask:, trust:, etc.), which then
 * silently fail and leave the user staring at a spinner.
 *
 * Fix: Override window.open. When the target URL looks like a wallet deep link
 * or any scheme the Telegram webview can't handle, route it through
 * Telegram.WebApp.openLink (external browser) or openTelegramLink (tg://).
 *
 * Call this once at app boot, BEFORE any wallet SDK initializes.
 *
 * References:
 * - https://github.com/reown-com/appkit/issues/1530
 * - https://docs.reown.com/appkit/features/telegram-mini-apps
 */

type TgWebApp = {
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  platform?: string;
};

const WALLET_SCHEMES = [
  'wc:',
  'metamask:',
  'https://metamask.app.link',
  'trust:',
  'https://link.trustwallet.com',
  'bitkeep:',
  'https://bkcode.vip',
  'https://bitkeep.jnj.mobi',
  'core:',
  'https://core.app',
  'rainbow:',
  'https://rnbwapp.com',
  'ledgerlive:',
];

function isWalletDeepLink(url: string): boolean {
  const lower = url.toLowerCase();
  return WALLET_SCHEMES.some((s) => lower.startsWith(s));
}

function getWebApp(): TgWebApp | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp ?? null;
}

let installed = false;

export function installTelegramWindowOpenShim(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;

  const webApp = getWebApp();
  if (!webApp) return; // not running inside Telegram — no shim needed

  const originalOpen = window.open.bind(window);

  (window as any).open = (
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null => {
    try {
      const href = typeof url === 'string' ? url : url?.toString() ?? '';
      if (!href) return originalOpen(url as any, target, features);

      // tg:// and t.me links → stay inside Telegram
      if (href.startsWith('tg://') || href.startsWith('https://t.me/')) {
        webApp.openTelegramLink?.(href);
        return null;
      }

      // Wallet deep links → hand to Telegram so iOS actually follows them
      if (isWalletDeepLink(href)) {
        webApp.openLink?.(href, { try_instant_view: false });
        return null;
      }

      // Generic https:// — let Telegram route it externally, which is
      // more reliable than window.open inside the webview
      if (href.startsWith('https://') || href.startsWith('http://')) {
        webApp.openLink?.(href, { try_instant_view: false });
        return null;
      }

      return originalOpen(url as any, target, features);
    } catch (err) {
      // If anything goes wrong, fall back to the original
      console.warn('[TgShim] window.open override failed:', err);
      return originalOpen(url as any, target, features);
    }
  };

  installed = true;
  // eslint-disable-next-line no-console
  console.log('[TgShim] window.open shim installed for Telegram webview');
}
